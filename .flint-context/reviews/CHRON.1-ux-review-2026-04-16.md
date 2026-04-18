# UX Review: CHRON.1 — Reason-on-Override

**Date:** 2026-04-16
**Reviewer:** flint-ux-critic
**Phase:** CHRON.1 end-of-round ceremony

---

**Grade: B**

A solid, correctly-scoped feature with clean risk tiering and respectable technical plumbing — but the DiffCard surface still speaks to developers, not designers. The reason input is functionally right, visually thin, and linguistically silent on *why* it matters. CHRON.1 ships a compliance primitive; it hasn't yet shipped a compliance *experience*.

---

## Gate Results

1. **Audience:** PASS — Serves both Designer (DiffCard in Glass approval flow) and compliance/auditor (SARIF enrichment, ViolationCard past-reason display). Engine-side wiring is correctly in `flint-mcp/` and Glass-side is correctly in `src/`.
2. **Behavior:** PASS — "Designers and agents can now *annotate why* a high-risk governance mutation was approved, and that reason persists into audit trails, SARIF, and the violation list for future viewers." Clear and defensible.
3. **Priority:** PASS (with caveat) — Red tier is the 5% demo moment (rare, high stakes). Amber is the 80% case. The calibration is correct; the copy isn't (see below).
4. **Journey:** PASS — Touches Journey 5 (Govern: Review AI Mutation) and Journey 7 (Review Past Overrides). Respects the emotional arc — red tier creates intentional friction at a decision point, not a relief point.
5. **Layout:** PASS — DiffCard lives in the agent chat surface (host IDE chat panel, not Glass). ViolationCard lives in the right sidebar Governance tab. Both placements are compliant with the 3-panel model.
6. **Cost:** PASS — Medium. Existing schema columns, no new IPC channels, no new stores. The DDL guard in `electron/store.ts` is a small but real maintenance debt.

---

## Critical Issues (Block SHIP)

**None.** The implementation is contract-faithful, tests cover the 8 DiffCard boundaries, and the data flow from DiffCard → IPC → ledger → SARIF → ViolationCard is wired end-to-end. Nothing here warrants blocking.

---

## Improvements for A+

### 1. The copy is too neutral. A designer can't tell amber from red from the prompt alone.

Today both amber and red show *"Why is this change needed?"* — the amber variant just adds *"(optional)"*. A designer glancing at the card sees the same question either way. They don't know:

- Red: *"This will be the permanent record for this mutation. Be specific."*
- Amber: *"Optional — helps teammates understand this change in a week."*

**Specific change:**
```
Amber placeholder: "Why this change? (optional, for teammates)"
Red placeholder:   "Required: reason for this high-risk change"
```

The risk tier badge (Low risk / Review / High risk) is already above — but a designer doesn't connect the badge to the input. Wire them: at red tier, the input border should pick up the red tier tint (e.g., `border-red-500/40` matching `ShieldAlert`). At amber, match the amber tint. This makes the risk tier visible *inside* the input field, not just floating above it.

### 2. "Skipped" as a silent default is a compliance smell.

From the contract: *"Amber reasons that say 'skipped' are filtered from SARIF and ViolationCard display."* A designer who clicks Apply with an empty amber input gets a silent `'skipped'` write to the ledger. They never know their skip was recorded. Two problems:

- **Compliance auditor view:** skipped counts are invisible. If 80% of amber mutations ship with "skipped" reasons, that's a signal that amber tiering is too aggressive (or too lax) — but you can't see it.
- **Designer trust:** Silent logging of *anything* about a user's action is a dark-pattern cousin. Designers who later discover the ledger has `'skipped'` rows will feel surveilled.

**Recommended fix:** After Apply at amber with empty input, show a one-line confirmation toast: *"Logged without a reason. Undo?"* or a micro-inline note *"Logged as 'no reason given'"*. OR: don't write `'skipped'` at all — store `null` and let SARIF/ViolationCard treat null-reason-at-amber as "applied, no reason". The string `'skipped'` is an MCP implementation detail that has no place in the user mental model.

### 3. "Overridden: [reason]" is too terse for past-decision review.

The ViolationCard pattern is `Overridden: brand team approved`. A designer reviewing this a week later asks:
- Who overrode? (Designer? Agent? Which one?)
- When? (Yesterday? Last sprint?)
- For which mutation? (A specific class change? A structural edit?)

The contract already defines `OverrideReasonDisplayProps` with `overrideTimestamp` and `overrideActor` — but the ViolationCard implementation (line 532-540) displays only the reason text. This is a dropped prop.

**Specific change:** Show at least relative time (`Overridden 2 days ago: "brand team approved"`) and, when available, the actor (`Overridden by Justin 2 days ago: "brand team approved"`). The italic grey styling is right; the density is wrong.

### 4. "Red tier" language is developer jargon.

The RiskBadge shows *"High risk"* (good). But Justin called this out directly: a designer doesn't know what "red tier" means in the context of a class-name change. The prompt *"Why is this change needed?"* doesn't communicate *what is risky* about the change.

**Recommended:** Red-tier DiffCards should include a one-line framing above the input: *"This change affects [structure / semantics / accessibility] and can't be easily undone."* Derive the framing from the toolName (flint_delete_node → "removes an element", flint_wrap_node → "restructures the DOM", etc.). The input then reads as a response to a stated risk, not an arbitrary gate.

### 5. Visual hierarchy — the input is a sibling of Apply/Reject, but reads like a receipt field.

The current layout:
```
[mutation summary]
[AI reasoning]
[diff block]
──
[reason input       ]
[Apply] [Reject]
```

The reason input at amber/red tier is functionally *part of the decision* but visually reads like a detail appended to the action buttons. At red tier especially, this is backwards — the reason is the primary decision, and Apply is the confirmation.

**Recommended:** At red tier, wrap the input in a subtle container with a heading: *"Sign-off required"* above the input, then the input, then Apply/Reject below. This signals the input is the primary interaction. At amber, the current layout is fine — amber is deliberately low-friction.

### 6. No empty-value hint on what a "good" reason looks like.

Typed-reason compliance depends entirely on designer discipline. *"ok"*, *"fine"*, *"tim said so"* will flow straight into SARIF and be useless to an auditor 6 months later. Compare to other tools that do this well (GitHub PR descriptions show a template, Jira shows example reasons).

**Recommended:** Add a helper row below the input at red tier: *"Examples: 'Approved by brand team', 'Required by WCAG exception process', 'Temporary fix — ticket FLINT-123'"*. Don't validate — just prime the pattern.

### 7. The type smoke check import path is fragile.

Test file imports from `'../../../../.flint-context/contracts/CHRON.1.contract'` — a path that reaches out of `src/` into `.flint-context/`. This is correct per the contract-first workflow, but it means moving or renaming the contract file silently breaks the test. Not a user-facing issue, but worth a lint rule or a types re-export from `shared/contract-schema.ts`.

---

## What Works Well

1. **Risk tier calibration is right.** Green/none → amber/optional → red/required maps cleanly to "you won't care / we hope you do / you must". The ordinal step is the right one.
2. **Zero new IPC channels.** The team discovered the schema already supported reason columns and wired the UI to existing infrastructure. This is exemplary — it shipped a compliance feature without adding a byte of new MCP surface area.
3. **`'auto'` for green tier** — storing a literal string means the audit trail can distinguish "green tier, no human asked" from "null, unknown reason" from "user said something". Smart data modeling.
4. **Whitespace-only reasons don't enable Apply at red.** This is a small detail most teams miss. Good guard.
5. **Filtering `'skipped'` from ViolationCard display** — correct. A past "skipped" override has no narrative value to a reviewer.
6. **ResolveReasonForStorage's dead-code comment** — the developer flagged `resolveReasonForStorage('red', '')` as unreachable from the UI but kept it as a defensive guard for programmatic callers. This is mature engineering documentation.
7. **`overrideReasonMap` is per-file** — GovernanceDashboard re-fetches on `activeFilePath` change. Past overrides follow the file, not the session. Correct.

---

## Questions for Justin

1. **Should "skipped" at amber be visible to the user?** Today it's silent. Your call: surveillance risk vs. audit completeness. My bias is to show a micro-confirmation ("Logged without a reason"), but you know the designer trust model better.
2. **Do we want the actor/timestamp in ViolationCard, or is that information already carried by the provenance chip?** The contract defines `overrideTimestamp` and `overrideActor` props that aren't currently rendered. Tension with the existing `via [source]` provenance chip pattern.
3. **Is red-tier framing ("This change affects structure and can't be easily undone") worth the engineering cost?** Requires mapping toolName → framing text. Could be a follow-up (CHRON.1.1).
4. **Example reasons in red-tier helper text — show them always, or only on focus?** Always = clearer expectation. On focus = less visual weight at rest. Your call.
5. **The `'skipped'` sentinel value vs. null** — do you want to rename this to `null` throughout, or leave it as an MCP-side implementation detail? The sentinel string bleeds into type signatures (`resolveReasonForStorage` returns `'skipped'` explicitly).

---

## Summary

**Grade: B.** CHRON.1 ships a mechanically correct reason-on-override primitive — the wiring is clean, tests cover the 8 DiffCard boundaries, and the team impressively shipped a compliance feature with zero new IPC channels. The risk tiering (none/optional/required) is the right ordinal step, and the red-tier whitespace guard shows mature judgment.

But the experience reads as a compliance surface, not a designer tool. Three findings keep this out of A range:

1. **Copy is too neutral.** Amber and red share *"Why is this change needed?"* — a designer can't tell the two tiers apart from the prompt. Differentiate: *"Why this change? (optional, for teammates)"* at amber, *"Required: reason for this high-risk change"* at red. Tint the input border to match the risk badge so the tier is visible inside the field.

2. **"Skipped" is a silent default.** Empty amber inputs write `'skipped'` to the ledger with no user feedback. Either show a micro-confirmation toast ("Logged without a reason") or store `null` and drop the sentinel string from the user mental model entirely. Silent ledger writes are a trust smell.

3. **"Overridden: [reason]" in ViolationCard is too terse.** The contract defines `overrideTimestamp` and `overrideActor` props that aren't rendered. Past-decision review needs *when* and *who*, not just *why*. Adding `Overridden by [actor] [relative time]: "reason"` is a one-line change that transforms audit value.

No critical issues block SHIP. The feature can ship as B-grade and iterate to A in a CHRON.1.1 follow-up focused on copy, empty-state semantics, and ViolationCard density. If you want A before shipping, the three fixes above are small and well-scoped.
