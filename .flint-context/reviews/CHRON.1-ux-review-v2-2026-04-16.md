# UX Review: CHRON.1 A+ Polish (v2)

**Date:** 2026-04-16
**Reviewer:** flint-ux-critic
**Phase:** CHRON.1 polish-pass verification (follow-up to v1 grade B)

## New Grade: A-

The polish pass nailed every isolated component-level issue from v1 — and then a wiring regression broke the most visible deliverable. The DiffCard is genuinely A+ in isolation. The ViolationCard component renders the `Overridden by [actor] [time]: "reason"` shape exactly as spec'd. But in the running Glass app the override row will never render, because the data wiring from `GovernanceDashboard` → `ViolationsList` → `ViolationCard` was lost in the polish round.

---

## Verification of Prior Findings

### Finding #1 — Copy differentiation + risk tints — RESOLVED

- `DiffCard.tsx` placeholders differentiated: Amber "Why this change? (optional, for teammates)", Red "Required: reason for this high-risk change"
- Input borders pick up tier tints: `border-red-500/40`, `border-amber-500/30`
- 8 tests including negative assertions

### Finding #2 — Drop the `'skipped'` sentinel — PARTIAL

- Glass-side fixed: DiffCard sends `''` for empty amber; orchestratorStore truthy guard means no IPC call
- Sentinel survives in contract + SARIF filter as defensive legacy code
- Trust smell removed; mental model half-migrated
- Trade-off: empty amber now produces zero observable signal (no toast, no ledger row) — audit metrics for "applied without justification" are unrecoverable

### Finding #3 — ViolationCard actor + timestamp — PARTIAL (component RESOLVED, integration NOT WIRED)

**Component in isolation is A+:**
- Props `overrideReason`, `overrideActor`, `overrideTimestamp` accepted correctly
- `overrideHeader` builds the spec'd shape in all 4 fallback quadrants (both / actor-only / timestamp-only / neither)
- `formatRelativeTime` exported, handles invalid dates, covers singular/plural, 10 unit tests

**But integration is broken:**
- `ViolationsList.tsx` — `MithrilCardData` and `A11yCardData` interfaces do NOT include the 3 new fields
- `ViolationsList.tsx` — `<ViolationCard>` invocations don't pass the props
- `GovernanceDashboard.tsx` — 0 matches for `overrideReason`, `overrideActor`, `overrideTimestamp`, `metadata`
- The `overrideReasonMap` builder referenced by v1 review and code review no longer exists in current source

Net: ViolationCard component is A+. Integration is 0/10 — no override row will render in production under any condition.

### Bonus polish — Red-tier framing per tool — RESOLVED, well-judged

- `framingForTool` covers 5 named tools + sensible default
- Tested green/amber do NOT show framing
- Reads like real risk descriptions, not filler

### Bonus polish — Example reasons hint — RESOLVED, well-judged

- Examples shown as low-weight text below red-tier input only
- 3 examples cover brand approval, regulatory exception, temp fix archetypes

---

## New Issues Introduced by Polish

### NEW-1 (HIGH) — ViolationCard override row dead in production

Repair:
1. Add `overrideReason: string | null`, `overrideActor: string | null`, `overrideTimestamp: string | null` to `MithrilCardData` and `A11yCardData`
2. Pass these 3 fields to each `<ViolationCard>` invocation in ViolationsList
3. Restore the `overrideReasonMap` builder in GovernanceDashboard — fetch audit log on `activeFilePath` change, filter override rows, parse metadata JSON defensively, build `Map<ruleId, {reason, actor, timestamp}>`, wire into card builders
4. Add integration test: given seeded audit log, assert override row appears on matching card

Estimated fix: ~40 lines in 2 files.

### NEW-2 (LOW) — Redundant filter in ViolationCard

`'skipped'`/`'auto'` filter in ViolationCard and also in dashboard (once rewired). Small future-bug magnet.

### NEW-3 (LOW) — Silent empty-amber may surprise designers

No toast, no ledger row. Audit metric "applied without justification" is unrecoverable. Acceptable trade-off but worth naming.

---

## What Works Brilliantly

1. **DiffCard tier differentiation is genuinely audience-aware** — designer sees right prompt + right tint + right example primer at the right moment
2. **Red-tier framing per toolName is taste, not filler** — each line describes the actual risk, default is dignified
3. **`formatRelativeTime` correctly exported and exhaustively tested**
4. **Fallback matrix for actor + timestamp correct in every quadrant**
5. **HANDOFF.md honest about scope** — no marketing fluff
6. **Test pyramid sound** — 36 tests across DiffCard + ViolationCard contract coverage

---

## Residual Questions for Justin

1. **Is NEW-1 (override row not wired into dashboard) a SHIP-blocker?** My read: yes — finding #3 from v1 was blocking-for-A. Either repair before SHIP or explicitly de-scope.
2. **Repair estimate ~40 lines in 2 files.** Component, IPC handler, and hook surface all already there — only plumbing missing.
3. **Empty amber silent behavior OK?** If not, add "Logged without a reason" toast.
4. **Rename `'skipped'`/`'auto'` sentinels to `null`?** Follow-up cleanup.

---

## Critical Question Answered

**Is there anything a designer using this in anger would still trip over?**

Yes. A designer who overrides a rule will see no record of that decision on the violation card the next time they open the file. Contradicts finding #3 spec. Component is built for this; dashboard isn't feeding it.

Everything else: DiffCard polish is real and durable. If the dashboard wiring lands, this is A+ on every dimension v1 raised.
