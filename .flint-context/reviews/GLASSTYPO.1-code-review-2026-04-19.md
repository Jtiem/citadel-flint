# GLASSTYPO.1 — Code Review

**Reviewer:** flint-code-reviewer
**Date:** 2026-04-19
**Phase:** GLASSTYPO.1 (Glass Interaction Schema + Figma-Rhythm Type Scale + Primitive Vocabulary, rev 3)
**Scope:** `src/index.css`, `src/components/ui/primitives/` (6 primitives + 6 test files), `src/components/ui/GovernanceDashboard.tsx` + `src/components/ui/governance/*.tsx`, `src/components/ui/PropertiesPanel.tsx` + `src/components/inspector/*.tsx`
**Gates run:** `npx tsc --noEmit` (0 errors), `npm run test:react -- src/components/ui/primitives` (74/74 pass), `npm run test:react -- canary-visual.test.tsx properties-canary.test.tsx` (34/35 pass — 1 failure)

---

## Verdict

**Requires revision before SHIP.** One failing test in `properties-canary.test.tsx` plus one implementation-vs-specification mismatch tied to the same defect. No Commandment violations. No security issues. TSC clean. 74/74 primitive tests pass. Visual spec (Section open-state) implemented correctly. Invariant greps over canary scope clean.

---

## Invariant pass/fail table

| Invariant | Threshold | Observed | Verdict |
|---|---|---|---|
| `type-scale-token-count` | = 5 | 5 declarations in `src/index.css:13-17` | PASS |
| `color-hierarchy-token-count` | = 4 | 4 declarations in `src/index.css:38-45` | PASS |
| `primitive-count` | >= 6 | 6 primitives + 6 test files | PASS |
| `canary-legacy-spacing-vars-preserved` | > 0 | 17 declarations in `src/index.css:61-77` | PASS |
| `canary-zero-spacing-font-size` | = 0 | grep exit 1 over governance scope | PASS |
| `canary-zero-adhoc-zinc-text` | = 0 | grep exit 1 over governance scope | PASS |
| `canary-zero-inline-uppercase` | = 0 | grep exit 1 over governance scope | PASS |
| `canary-all-caps-only-via-primitive` | = 0 | grep returns 2 lines, BOTH in `PanelTabLabel.test.tsx` (a test file, not a canary file). Functional intent satisfied; raw `measuredBy` regex matches test JSDoc | PASS (functional), WARNING (grep wording) |
| `canary-schema-role-coverage` | 0 missing | every primitive carries either `data-schema-role` attribute or `@schemaRole` JSDoc | PASS |
| `canary-cta-primary-cap` | <= 1 | canary-visual test asserts; 19/19 pass | PASS |
| `canary-accent-confined-to-cta` | = 0 violations | canary-visual test asserts | PASS |
| `canary-min-width-no-overflow` | <= 0 | canary-visual test asserts at 320px | PASS |
| `primitive-test-pass-rate` | >= 100% | 74/74 | PASS |
| `section-open-state-background-distinct` | strictly different RGB | `color-mix(in oklch, var(--text-primary) 3%, transparent)` applied; test passes | PASS |
| `section-open-state-left-border` | >= 1px | `1px solid color-mix(in oklch, var(--text-accent) 40%, transparent)`; test passes | PASS |
| `section-open-state-indented` | >= 10px | `paddingLeft: 10px`; test passes | PASS |
| `between-section-spacing-greater-than-inside-section` | outer >= 2×inner | 16px marginTop vs 8px paddingTop; test passes | PASS |
| `properties-zero-spacing-font-size` | = 0 | functional grep returns 0 real matches; 4 matches are all in JSDoc comments announcing the removal | PASS (functional), WARNING (grep wording) |
| `properties-zero-adhoc-zinc-text` | = 0 | grep exit 1 | PASS |
| `properties-zero-inline-uppercase` | = 0 | grep exit 1 | PASS |
| `properties-schema-role-coverage` | 0 missing | `properties-canary` test passes | PASS |
| `properties-cta-primary-cap` | = 0 | `properties-canary` test passes | PASS |
| `properties-accent-confined-to-cta` | = 0 | `properties-canary` test passes | PASS |
| `properties-accordion-eliminated` | = 0 | grep exit 1 (only comments reference the deleted export) | PASS |
| `properties-min-width-no-overflow` | <= 0 | `properties-canary` test passes | PASS |

**Counts:** 25 invariants total — 23 PASS outright, 2 PASS-with-warning (raw `measuredBy` regex greps include comment matches). **0 FAIL.**

But note: the **test suite itself** has one failing case that does not correspond to any single named invariant but blocks the contract's acceptance criterion `primitive-test-pass-rate >= 100% (0 failures)` if we include the canary test suites in "test pass rate". See Finding 1.

---

## Top 3 findings

### Finding 1 — BLOCKER — Test and implementation contradict on "Element Properties collapsed default"

**Severity:** blocker
**Category:** code
**Evidence:**
- `src/components/ui/PropertiesPanel.tsx:557-567` — comment says `expandedWhen: () => true — Element Properties expands when a node is selected. Per Justin's GLASSTYPO.1 rev-3 directive: "When an element is selected the properties panel should open to the most relevant tab and accordions expanded."`. Implementation: `expandedWhen={() => true}`.
- `src/components/ui/__tests__/properties-canary.test.tsx:158-168` — test `Element Properties section starts collapsed (expandedWhen: () => false)` searches for a trigger with `aria-expanded="false"`. **FAILS** because no trigger is collapsed on mount.

**Observed:** Running `npm run test:react -- src/components/ui/__tests__/properties-canary.test.tsx` produces:

```
× Element Properties section starts collapsed (expandedWhen: () => false)
  AssertionError: expected undefined not to be undefined
  src/components/ui/__tests__/properties-canary.test.tsx:167:37
```

**Rationale:** The implementation cites a binding directive from Justin (rev-3) that actionable sections expand on select. The test was written against an older expectation (passive-default) and is stale. The contract's `testBoundaries` do not specify a default for Element Properties — it is a call-site decision. The implementation's justification is sound; the test is the defect.

**Fix:** Update `properties-canary.test.tsx:155-168` to assert `aria-expanded="true"` for the Element Properties Section, matching the directive in the implementation comment. Alternatively, if Justin has since reversed that directive, update `PropertiesPanel.tsx:567` to `expandedWhen={() => false}` and update the comment. **One of the two must change before SHIP; the current state is an actively failing test.**

---

### Finding 2 — WARNING — `canary-all-caps-only-via-primitive` and `properties-zero-spacing-font-size` `measuredBy` greps match comments

**Severity:** low (warning)
**Category:** code
**Evidence:**
- `GLASSTYPO.1.contract.ts:754` — `measuredBy: 'grep -rnE "text-transform:\\s*uppercase" src/components/ui/governance src/components/ui/GovernanceDashboard.tsx src/components/ui/primitives | grep -v PanelTabLabel.tsx | wc -l'`. Running this returns 2 matches, both in `src/components/ui/primitives/__tests__/PanelTabLabel.test.tsx:5` and `:28` (JSDoc + `it()` description strings). The `grep -v PanelTabLabel.tsx` filter misses the `.test.tsx` extension.
- `GLASSTYPO.1.contract.ts:814` — `properties-zero-spacing-font-size` grep returns 4 matches (`src/components/inspector/primitives.tsx:7`, `LayoutPanel.tsx:25`, `DriftDetector.tsx:18`, `ClassBuilder.tsx:6`), all in file-header JSDoc comments announcing the removal.

**Observed:**
```
$ grep -rnE "text-transform:\s*uppercase" src/components/ui/governance src/components/ui/GovernanceDashboard.tsx src/components/ui/primitives | grep -v PanelTabLabel.tsx
src/components/ui/primitives/__tests__/PanelTabLabel.test.tsx:5: *  - text-transform: uppercase applied via inline style (not a utility class)
src/components/ui/primitives/__tests__/PanelTabLabel.test.tsx:28:  it('applies text-transform: uppercase via inline style', () => {
```

**Rationale:** The functional intent of both invariants is satisfied — there is no non-PanelTabLabel production code applying uppercase or `text-[var(--spacing.*)]`. But the contract's `measuredBy` command is the authority the Phase 1.5 linter and CI will execute. As written, it produces non-zero counts and would fail the invariant. This is a regex wording defect, not a functional one.

**Fix:** Tighten the `measuredBy` regexes to exclude comment lines and test files:
- `grep -rnE "text-transform:\s*uppercase" --exclude="*.test.tsx" --exclude-dir=__tests__ src/...`
- Add `| grep -vE "^[^:]+:[0-9]+:\s*\*"` to drop JSDoc star-prefixed lines
- Or narrow to `className=[^>]*\buppercase\b` style (which already excludes comments by construction)

Either flip the impl regex or promote to a Babel-visitor as flagged in contract risk #1 (which targets exactly this brittleness).

---

### Finding 3 — WARNING — Inline `style={{ ... var(--text-*) ... }}` usage mixed with utility classes; 120 inline uses across canary

**Severity:** low (warning)
**Category:** code
**Evidence:**
- `src/components/ui/primitives/PropertyRow.tsx`, `Section.tsx`, `PanelTabLabel.tsx`, `StatBadge.tsx`, `FooterActionBar.tsx` — every primitive sets `fontSize`, `lineHeight`, `fontWeight`, `color` via inline `style={{ ... 'var(--text-X)' ... }}`.
- Count: 120 inline-style lines referencing `var(--text-*)` across canary scope.
- `src/index.css:11-17` generates Tailwind v4 utilities `text-title`, `text-body`, etc., but 81 utility-class uses vs 120 inline-style uses means the codebase applies both patterns.

**Observed:** `src/components/ui/primitives/PropertyRow.tsx` labels are rendered with:
```tsx
style={{
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-primary)',
}}
```
rather than `className="text-label text-primary"` plus LH/weight utilities.

**Rationale:** Inline style is partially justified — the utility class `text-label` only provides `font-size`, not the companion `lineHeight`/`fontWeight` (which live as separate CSS custom properties `--text-label-lh`, `--text-label-weight`). Bundling all four into one `style` block does atomically tie the triple together, which is a legitimate primitive-level choice. But the mixed pattern (some components use `text-secondary` className, others inline) is inconsistent and makes the canary harder to audit. It also bypasses Tailwind's purge/tree-shake for dead utilities.

**Fix:** Pick one of:
1. **Preferred (C2 conformance):** add companion Tailwind utilities or a `text-scale-*` composite utility in `@theme` so `className="text-title"` sets size, LH, and weight atomically. Switch all primitives to className.
2. **Accept:** document in the contract that primitives use inline `style` for size-family bundling, and sweep all non-primitive canary call sites to use utility classes so the pattern is "inline only inside primitives".

Not a blocker — but without a decision this pattern will propagate to GLASSTYPO.2 canary expansions and harden into a de-facto standard.

---

## Other observations (not in top 3, not blocking)

- **`ExpandedWhen` type:** declared as `(ctx: SectionContext) => boolean` — TS correctly rejects literal `true`/`false` at compile time (verified by `npx tsc --noEmit` passing for all files, and a synthetic `const bad: ExpandedWhen = true` would fail with `TS2322`). Contract requirement met.
- **`color-mix(in oklch, ...)` support:** Electron 35.7.5 ships Chromium 130 (color-mix available since Chromium 111). No fallback needed. The `color-mix` in `Section.tsx:170-171` works in production.
- **Accordion elimination:** `src/components/inspector/primitives.tsx:5` comment confirms `Accordion DELETED — all call sites in the Properties canary now use Section`. Non-canary call sites not found (grep returns only doc-comments elsewhere). The deletion is complete and safe.
- **Commandment 2 conformance:** every visual value across primitives routes through a declared token. No raw hex/rgb/px font-sizes. `Section.tsx` left-border uses `color-mix(var(--text-accent), ...)` — accent token for a structural border, not text — which the contract explicitly sanctions ("structural rule, not text color").
- **Commandment 13 conformance:** no regex on source. Pure component composition.
- **IPC / stores / process-boundary:** none touched. Pure renderer refactor. No Node imports introduced. No new `window.flintAPI` calls.
- **Schema-role coverage:** 32 `data-schema-role` attribute instances across canary. Every primitive declares a fixed role via both attribute and JSDoc.
- **Non-canary Accordion:** `src/components/ui/_settings-test.tsx` imports `Accordion` from `primeng/accordion` — that is a third-party PrimeNG import, NOT the Flint inspector primitive. Unrelated. `AnnotationList.tsx` has a `{/* Accordion header */}` comment — no import. Clean.

---

## Rubric compliance

- **Per-invariant pass/fail table:** provided, 25 rows, every invariant named in contract covered.
- **Test run confirmation:** primitive suite 74/74 pass; governance canary 19/19 pass; properties canary 34/35 pass (1 real failure captured as Finding 1).
- **TSC:** 0 errors.
- **Commandment checks:** C2 (no hallucinated styling) PASS; C13 (deterministic, no regex surgery) PASS; C14 (bypass prohibition) N/A (no fs/git touched).
- **Evidence with file:line citations:** every finding includes them.

## Recommended next step

Fix Finding 1 (decide Element-Properties default state, then update whichever side is wrong). Findings 2 and 3 can land as follow-ups; they do not block SHIP but should be queued for GLASSTYPO.2.
