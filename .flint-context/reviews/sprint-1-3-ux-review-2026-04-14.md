# Sprints 1-3 Cross-Sprint UX Review — 2026-04-14

## Verdict: A- (ship with language cleanup backlog item)

## Sprint 1 + Sprint 3 UX Impact

**Sprint 1** (linters/services A+ sweep): backend-only. Zero user-visible surface change. UX impact: neutral — indirectly improves trust by tightening the engine that powers every Glass surface.

**Sprint 3** (policy engine): backend-only. Zero visible surface change in Glass. UX impact: neutral now, positive later — sound PDP/PEP foundations mean future policy UI will have deterministic semantics, a prerequisite for Counsel's "guidance-first" redesign.

## Sprint 2 UX Deep Dive

### HealthScoreAccordion default-open change

`src/components/ui/governance/HealthScoreAccordion.tsx:65` — `useState(true)`. This is a real behavioral change smuggled into a "pure refactor." Evaluated on merits: **keep it open**. The accordion surfaces the coaching sentence, score trend hint, sparkline, and sub-score breakdown — exactly the "why is my score what it is" payload a designer opens the Governance tab to see. With it collapsed, a first-time user sees a bare grade letter and has to hunt for the explanation. Open-by-default matches the EDU module's guidance-first posture and Counsel's "verdict-first → guidance-first" redesign direction. Accepted.

Caveat: `CompactScoreSummary` already renders a summary block above it, so users who know what they're doing will see near-duplicate information until they collapse it. Acceptable density cost for new users, who are the 80% case on this panel.

### Journey map alignment

Journey 7 (J7: "Observe design debt") terminates at `[Health score, grade, trend]` at `docs/JOURNEY-MAPS.md:845` and explicitly names `GovernanceDashboard` as the consumer of `.flint/debt-history.json` at line 1387. The open-by-default sparkline directly serves J7's emotional arc: relief after audit, then orientation ("am I getting better?"). No journey is harmed. No OPP regression found.

### Feature Budget Framework retroactive application

1. **Audience**: PASS — Designer (Glass). Correct layer.
2. **Behavior**: MARGINAL — "User can now see score breakdown without clicking." Weak but statable.
3. **80% vs 5%**: PASS — score breakdown is the daily observability case.
4. **Journey**: PASS — J7 alignment is clean.
5. **Layout**: PASS — stays inside the right sidebar Health tab, no new panel.
6. **Cost**: PASS (Low) — one boolean flip.

Retroactive verdict: **would have passed** with a soft note on Gate 2. The accident was benign.

### FocusTrap quality

`src/components/ui/FocusTrap.tsx` is a competent implementation: re-queries focusable elements per keydown (handles dynamic content), sorts by document position (jsdom-safe), restores previous focus on unmount, handles Escape, and has a `focusin` redirect that pulls escaped focus back. The `focusin` redirect is the only concern — if a screen reader's virtual cursor moves outside the modal, the trap will fight it. For a modal that's already `aria-modal="true"`, this is conventional behavior; AT users generally expect trapped modals. No blocker. A11y verdict: **Good, not perfect**. Recommend an NVDA/VoiceOver smoke test before the next release.

### PasteAuditModal error card

`PasteAuditModal.tsx:276-328` AuditErrorCard: default view shows icon + `error.message` only. Stack trace hidden behind a "Show details" chevron toggle, rendered as `<pre>` inside a bordered `bg-zinc-950` block. Correct progressive disclosure. **Friendliness depends on what `error.message` actually contains** — if the upstream producer sets it to "TypeError: Cannot read property 'foo' of undefined", the card is still developer-speak. The component did its job; upstream error-shaping is out of scope for this sprint. "Show details" affordance is appropriately tucked away. Verdict: **component-level PASS, upstream message quality is a separate concern**.

### Progressive disclosure preservation

Spot-checked the composition shell at `GovernanceDashboard.tsx:325-346`: `NoDesignSystemEmpty` guards on `tokenCount === 0`; the entire score/accordion block is wrapped in `{tokenCount > 0 && <>...</>}`; `ViolationsList` is additionally gated on `(mithrilCount > 0 || a11yCount > 0 || overridesExist)`; `GovernanceFooter` has its own visibility gate. PD invariants preserved. No regressions found.

### Governance language check

Grep for `violation|rogue|ΔE|drift` in `src/components/ui/governance/` returned **296 occurrences across 29 files**. Most are internal identifiers. User-visible strings still contain jargon:

- `HealthScoreAccordion.tsx:177-179` — "Critical violations / Amber violations / Advisory violations" in score formula modal. Plain English: "Critical issues / Warnings / Advisories."
- `CompactScoreSummary.tsx:99,118,137` — tooltip `title="Contains violations that block export"` → "Has issues that block export".
- `CompactScoreSummary.tsx:197,202,206` — "There are N existing violations being filtered" / "Show all violations" button.

These pre-date Sprint 2 (the refactor copied them verbatim from the 2,788-LOC original). **Sprint 2 did not reintroduce jargon — it preserved it.** Not a blocker, but a documented backlog item for Counsel.

### Composition shell readability

404 LOC, 18 hook calls, 15 rendered components. The shell reads cleanly for a human:
- Top: store slices (clearly labeled)
- Middle: wave-1 hook calls one-per-line with alignment
- Bottom: JSX tree is a flat render list with meaningful prop names

The only readability smell is `mithrilCards` and `a11yCards` assembly at lines 277-291 — both are one-liner `.map()` closures with 15+ properties each on one line. A designer tracing "where does `isDeferSuccess` come from" will struggle. Recommend formatting those two blocks across multiple lines in a follow-up; not a blocker.

Composition shell verdict: **readable, minor cosmetic debt in card assembly**.

### Designer trust

Gut check from a first-time UX designer's perspective: the panel now has a clear hierarchy (Header → Score summary → Score breakdown → Fix-all CTA → Violations → Footer → More details), the score breakdown defaults open so I don't feel I'm missing information, and errors in the paste flow look like a proper alert card instead of a crash dump. Trust signal: **positive**. The jargon in the formula modal is the only thing that would make me squint.

## Recommendation

**Ship as-is.** Two follow-up backlog items:

1. **EDU-followup**: plain-language sweep of user-visible strings in `HealthScoreAccordion` modal + `CompactScoreSummary` tooltips ("violations" → "issues"). Ties into the Counsel redesign.
2. **Sprint-2-polish**: reformat `mithrilCards` / `a11yCards` closures in `GovernanceDashboard.tsx:277-291` across multiple lines.

Neither blocks merge. The HealthScoreAccordion default-open accident passed the Feature Budget Framework retroactively, aligns with Journey 7, and serves the 80% case. I would not revert it.
