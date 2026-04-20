# GLASSTYPO.1 — UX Review (End-of-Round)

**Reviewer:** flint-ux-critic
**Date:** 2026-04-19
**Dimension:** ux
**Scope:** Governance + Properties canary refactor against the Glass Interaction Schema
**Verdict source:** `deriveVerdict()` from `shared/review-schema.ts` — no letter grade assigned here.

---

## What I evaluated

1. Interaction Schema adherence across both canary panels (7 roles, accent-only-on-CTA, cta-primary cap).
2. Section open-state visual treatment in practice (tint, left-accent border, 10px indent).
3. `expandedWhen` predicate behavior (passive vs actionable Sections).
4. Color ladder discipline (primary/secondary default, tertiary compression-only, accent CTA-only).
5. Real hierarchy delivered by the 5 type tokens (13/12/11/10/20).
6. MetadataTooltip migration — does moving "Tracking starts after first audit" behind hover improve or harm discoverability?
7. FooterActionBar treatment — is the chevron-suffixed nav-link row readable?

Evidence drawn from:
- `src/index.css:11-46` (token declarations)
- `src/components/ui/primitives/*.tsx` (all 6 primitives)
- `src/components/ui/GovernanceDashboard.tsx` + `src/components/ui/governance/*.tsx` (20 files)
- `src/components/ui/PropertiesPanel.tsx` + `src/components/inspector/*.tsx` (5 files)
- Test coverage in `src/components/ui/governance/__tests__/canary-visual.test.tsx` and `src/components/ui/__tests__/properties-canary.test.tsx`

---

## Gut read on hierarchy

The canary now reads meaningfully better than the "85% of text at 8px" baseline. The 13/600 title + 12/400 body pair gives section headers real weight, and the Section open-state treatment (3% primary tint + 1px accent left-border + 10px indent) does the parent-child job the contract asked of it — when a drawer is open you can tell without reading. The FooterActionBar pattern works; "Manage rules →" as a secondary chevron link correctly demotes a nav action that used to compete with CTAs.

But the migration is leaky in ways the contract's grep invariants do not catch, and the schema-role audit only covers a subset of components. The panel is better but not consistent; the Interaction Schema is aspirational inside the canary, not fully enforced. Most of the leaks are in visual loudness (accent-indigo used decoratively, arbitrary `text-xs`/`text-[10px]` sizes) rather than structural — they are fixable in a follow-up without re-architecting.

Specific issues in the findings below.

---

## Findings summary

| # | Severity | Title |
|---|----------|-------|
| F1 | major | Schema-role coverage is enforced on a handful of components, not the canary surface |
| F2 | major | Accent color leaks outside CTA subtrees via raw `text-indigo-300/400` utilities |
| F3 | major | Arbitrary font-size utilities (`text-xs`, `text-sm`, `text-[10px]`, `text-[9px]`) persist in 82 sites across the governance canary |
| F4 | minor | `FixAllCta` — the most visually prominent violation-panel button — carries no `data-schema-role` and uses raw indigo utilities |
| F5 | minor | Properties-panel "Element Properties" Section always expands (`expandedWhen={() => true}`), which trivializes the predicate and contradicts the canary-test comment that claims it starts collapsed |
| F6 | minor | `ZeroViolationCelebration` uses `text-xl`, `text-sm`, `text-xs`, and raw `text-emerald-300` across its hero — no schemaRole, no token vars, pure legacy Tailwind |
| F7 | info | MetadataTooltip migration hides "Tracking starts after first audit" behind a hover `(i)` — discoverability trade-off worth a Phase 3 visual check |
| F8 | info | Section body padding-right is 12px but headers get 0 right padding of their own beyond the outer `px-3`; the indent/outdent rhythm is subtly asymmetric |

---

## F1 — Schema-role coverage is enforced on a handful of components, not the canary surface

**Severity:** major
**Category:** ux
**Evidence:**
- `src/components/ui/governance/__tests__/canary-visual.test.tsx:55-104` asserts schema roles on `GovernanceHeader`, `AnomalyBanner`, `BatchActionBar`, `PendingApprovalsAccordion`, and a standalone `Section` — 4 of ~20 files in scope.
- `src/components/ui/governance/FixAllCta.tsx:27-39` — no `data-schema-role`, no `@schemaRole` JSDoc, not covered by the test.
- `src/components/ui/governance/ZeroViolationCelebration.tsx:35-60` — no schemaRole on the container, hero, title, description, or grade badge.
- `src/components/ui/governance/ViolationCard.tsx:411-498` — over 20 nested buttons and badges with no schema roles (Flag, Unflag, Defer, Preview Fix, Fix, deferred-badge, flagged-badge, navigation-index marker, snippet-copy button).

**Observed:** The invariant `canary-schema-role-coverage = 0 missing` is measured by a vitest test that renders a hand-picked subset of components, not the full `GovernanceDashboard` tree. Dozens of interactive elements in shipped canary files carry no role.

**Rationale:** Gate 5 (Layout Compliance) and the Interaction Schema both depend on every surface carrying an unambiguous role — that is the contract's Q4 decision. If the role is optional in practice, the schema collapses into documentation. Future migrations will inherit the ambiguity.

**Recommendation:** Either (a) tag every button/badge/row in the 25 canary files, or (b) narrow the invariant's scope to the tagged surfaces and state openly that the rest is un-schema'd. Option (a) is the contract's stated intent.

---

## F2 — Accent color leaks outside CTA subtrees via raw `text-indigo-300/400` utilities

**Severity:** major
**Category:** ux
**Evidence:**
- `src/components/ui/governance/ViolationCard.tsx:220` — `<code className="... text-indigo-300">` inside a snippet display, no CTA ancestor.
- `src/components/ui/governance/ViolationCard.tsx:411` — navigation-index badge with `bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-400/50`, serves as a "start here" marker, not a CTA.
- `src/components/ui/governance/ViolationCard.tsx:473-477` — Preview Fix / Fix buttons use `text-indigo-300`/`text-indigo-400`; these ARE CTA-adjacent actions but they are not tagged `cta-*` so the accent-confinement invariant cannot verify them.
- `src/components/ui/governance/FixAllCta.tsx:33` — `text-indigo-300 hover:text-indigo-200` on the big button; not tagged cta-primary/cta-secondary.
- `grep -rc "text-(indigo|emerald|amber|red|blue)-(300|400|500|600)" src/components/ui/governance` → 99 occurrences across 18 files.

**Observed:** The contract's accent-confinement test walks elements whose computed color resolves to `--text-accent` (oklch match). Tailwind's `text-indigo-300` and `text-indigo-400` resolve to DIFFERENT oklch values than `--text-accent` (`oklch(0.673 0.182 276.935)` = indigo-400 *exactly*; indigo-300 is lighter). So `text-indigo-300` escapes the test while still reading as accent to users.

**Rationale:** Schema §Q4: "Accent is CTA-only. Nav-links stay secondary." The user-facing rule is "indigo = actionable." Using indigo-300 on a read-only snippet, a wayfinding badge, or an un-roled button breaks that rule visually even if the computed-color test passes.

**Recommendation:** Expand the invariant to treat any `text-indigo-{200..500}` utility outside a `data-schema-role="cta-*"` subtree as a violation, OR migrate the call sites to `var(--text-accent)` behind a CTA tag. The wayfinding badge (`navigation-index`) should probably become `state-signal` with a neutral color.

---

## F3 — Arbitrary font-size utilities persist in 82 sites across the governance canary

**Severity:** major
**Category:** ux
**Evidence:**
- `grep -rc "text-xs|text-sm|text-\[10px\]|text-\[11px\]|text-\[12px\]|text-\[13px\]" src/components/ui/governance` → 82 occurrences across 10 files.
- `src/components/ui/governance/ViolationCard.tsx:473,477,485,488,492,495,498` — 7 buttons/badges using `text-xs` instead of `[font-size:var(--text-label)]` or `[font-size:var(--text-body)]`.
- `src/components/ui/governance/ZeroViolationCelebration.tsx:53,56,59` — hero uses `text-xl`, `text-sm`, `text-xs` in immediate sequence.
- `src/components/ui/governance/FixAllCta.tsx:33` — `text-xs` on the primary fix-everything button.

**Observed:** The contract banned `text-[var(--spacing.*)]` (the original sin) and `text-zinc-{400..700}` (ad-hoc color). It did NOT ban Tailwind's built-in `text-xs`/`text-sm` or arbitrary `text-[Npx]`. Both are in active use.

**Rationale:** GLASSTYPO.1's stated purpose was "typography unifies behind 5 tokens." 82 arbitrary-size call sites means the 5-token discipline is partial — the panel still has an uncontrolled size vocabulary. The hierarchy will drift again as new code imitates these patterns.

**Recommendation:** Add an invariant to GLASSTYPO.2 (or hotfix to GLASSTYPO.1 before marking COMPLETE): `canary-no-raw-text-size = 0` measuring any `text-(xs|sm|base|lg|xl|2xl)` or `text-\[\d+px\]` in canary scope. Mechanical replacement to `[font-size:var(--text-{token})]` is safe.

---

## F4 — FixAllCta has no schemaRole and uses raw indigo utilities

**Severity:** minor
**Category:** ux
**Evidence:**
- `src/components/ui/governance/FixAllCta.tsx:27-39` — full-width indigo button, no `data-schema-role`, uses `border-indigo-500/50 bg-indigo-900/20 text-xs font-medium text-indigo-300`.

**Observed:** This is the visually most-prominent button in the violation-panel viewport when auto-fixable issues exist. It competes with GovernanceHeader's "Run Audit" (which IS `cta-primary`). Two visually-primary buttons, one tagged.

**Rationale:** Contract §cta-primary-cap-1 exists to prevent exactly this visual competition. The rule is being enforced by tags, not by sight.

**Recommendation:** Tag it `cta-primary` (and retag GovernanceHeader's Run Audit as `cta-secondary`, since when violations exist the headline action is to fix them, not to re-audit), OR redesign FixAllCta as a compact cta-secondary so the cap holds both semantically and visually.

---

## F5 — Properties-panel "Element Properties" Section trivializes the predicate

**Severity:** minor
**Category:** ux
**Evidence:**
- `src/components/ui/PropertiesPanel.tsx:564-571` — `<Section title="Element Properties" expandedWhen={() => true} stackItem={false}>`.
- `src/components/ui/__tests__/properties-canary.test.tsx:283-287` — test comment reads "Since Element Properties starts collapsed…" which contradicts the `() => true` predicate at the call site.

**Observed:** The predicate always returns `true`; there is no conditional "actionable lever detected" signal feeding the expansion decision. The contract's explanatory prose justifies this ("editing props IS an actionable lever") but the predicate form is now decorative — any future reviewer reading just the call site cannot tell why the Section is different from a plain div.

**Rationale:** The contract's rev-2 decision (Q1) was: "`expandedWhen` must encode the actionable-state rule." If the canonical call site uses `() => true` unconditionally, the pattern loses its teeth — the next developer will copy-paste and the predicate becomes cargo-culted.

**Recommendation:** Either pass `expandedWhen={(ctx) => ctx.hasSelectedNode}` (reading from SectionContext) so the rule is legibly encoded, OR document at the call site why `() => true` is the right answer here so future maintainers don't imitate without reading the contract.

---

## F6 — ZeroViolationCelebration ignores the new vocabulary entirely

**Severity:** minor
**Category:** ux
**Evidence:**
- `src/components/ui/governance/ZeroViolationCelebration.tsx:53-60` — hero renders `text-xl font-black text-emerald-300` → "A+", `text-sm font-semibold text-emerald-300` → title, `text-xs [color:var(--text-secondary)]` → description.
- No `data-schema-role` on the container, hero circle, grade letter, title paragraph, or description paragraph.

**Observed:** The "Perfect score" celebration is the only place `--text-display` (20px) could have a legitimate second use outside the compact score summary's 20px number — it's the literal headline of a celebration state. Instead it uses `text-xl` (which Tailwind resolves to 20px/1.25 anyway, but untokenized).

**Rationale:** The component was in the canary scope, got touched (based on file mtime in the review diff), but was not migrated. It reads as inconsistent with the sister CompactScoreSummary which DOES use `--text-display`.

**Recommendation:** Mechanical migration to `[font-size:var(--text-display)]`, `[font-size:var(--text-body)]`, `[font-size:var(--text-label)]` and add schemaRole tags (`primary-content` on hero, `support-evidence` on description).

---

## F7 — MetadataTooltip discoverability trade-off

**Severity:** info
**Category:** ux
**Evidence:**
- `src/components/ui/primitives/MetadataTooltip.tsx:88-106` — renders content only on hover/focus; trigger is a cursor-default `<button>` with an icon.
- Contract §rev-2 Q2/Q3 prescribes MetadataTooltip for passive prose like "Tracking starts after first audit."

**Observed:** Users who previously saw the explanatory text always-visible must now hover an `(i)` icon to see it. On touch devices or with keyboard-only users, the focus-reveal works but is less discoverable. The trigger has `cursor-default` which reads as "not clickable" — it may signal "decorative" to users who don't try focusing.

**Rationale:** Metadata role compression is a legitimate trade — panels were overcrowded. But "Tracking starts after first audit" is onboarding context: users who've never seen it once probably need it always visible. Tooltip surfaces are appropriate for "reminder" metadata, not "first-encounter explanation."

**Recommendation:** Non-blocking — Justin should eyeball whether the two specific tooltipped strings in the canary feel hidden at 320/360/400 widths. If yes, consider an inline always-visible `--text-tertiary` line for first-run state, collapsing to tooltip after first acknowledgement.

---

## F8 — Section body padding rhythm is slightly asymmetric

**Severity:** info
**Category:** ux
**Evidence:**
- `src/components/ui/primitives/Section.tsx:169-176` — body style: `paddingLeft: 10px, paddingTop: 8px, paddingBottom: 8px, paddingRight: 12px`.
- `src/components/ui/primitives/Section.tsx:115` — header has `px-3 py-2` (12px horizontal).

**Observed:** Header's 12px horizontal padding aligns with body's 12px right but NOT body's 10px left. At 320px the 2px offset is below perceptual threshold; at 400px it is faintly visible as a left-lean.

**Rationale:** The contract chose 10px deliberately (chevron+title = 6+4) to create an "inset." The math works for the first section where the chevron is visible; for nested content (no chevron at body level) the inset relates only to the 1px accent border, not the header content.

**Recommendation:** Accept as-is for Phase 3 visual check, or tighten to 12px body left-padding (still > header chevron inset because the 1px accent border sits at the 0 offset). Not load-bearing for invariants.

---

## Scope coverage

**Reviewed:**
- All 6 primitives under `src/components/ui/primitives/`
- GovernanceDashboard composition + 20 governance/* children (spot-check on ViolationCard, FixAllCta, ZeroViolationCelebration, GovernanceHeader, GovernanceFooter, HealthScoreAccordion, CompactScoreSummary)
- PropertiesPanel + inspector/* migration
- Both canary test files
- Token declarations in `src/index.css`

**Skipped / not covered:**
- Token panel, StatusBar, Assets, ExportModal, Command Palette (out of scope by contract §non-goals)
- Runtime visual check at 320/360/400px (jsdom-only review; Justin to spot-check)
- Screen-reader walkthrough (keyboard focus order verified structurally, not by audio)
- Hover-state color ramps beyond the static declarations

---

## Suggested threshold call (for Justin)

Three major findings (F1, F2, F3) share a root cause: the contract's invariants were precise but narrow — they caught the originally-enumerated offenders (spacing-vars, zinc text, inline uppercase, Accordion imports) but did not quarantine the broader "arbitrary Tailwind utilities" surface. The migration is ~70% complete: the schema, tokens, and primitives are real; the enforcement net has holes.

Options:
1. Mark GLASSTYPO.1 COMPLETE as-is, open GLASSTYPO.1.1 hotfix for F1-F4 before merging GLASSTYPO.2 (recommended — preserves momentum).
2. Block COMPLETE pending F1-F4 fixes (conservative — costs a day).
3. Accept all findings; Phase 3 visual review decides whether the leaks hurt enough to warrant a pass (liberal).

The verdict below is derived, not assigned.
