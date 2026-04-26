# GLASSTYPO.1 — Glass Interaction Schema + Figma-Rhythm Type Scale + Primitive Vocabulary (Governance + Properties Canary)

**Status:** APPROVED (pending Phase 1.5 contract lint)
**Owner:** flint-architect
**Date:** 2026-04-19 (rev 3 — Properties-panel canary expansion + Section open-state visual spec)
**Audience:** designer (Glass-only; no MCP surface, no CLI)

---

## What changed in rev 3

Two expansions driven by Justin's review of the Properties panel:

1. **Section open-state visual spec.** Justin: "It is difficult to tell when a drawer is open as it has the same background as surrounding elements and is left-aligned along with every other content alignment." The Section primitive must render a visually distinct open state (tint + accent rule + indent + tighter inside-section rhythm). Encoded as 4 new measurable invariants.
2. **Properties panel joins the canary.** Same rigor as Governance. Scope: `src/components/ui/PropertiesPanel.tsx` + `src/components/inspector/*.tsx` (4 files). Current violation counts: 34 `text-[var(--spacing.*)]`, 19 `text-zinc-{400..700}`, 4 inline `uppercase` — all zeroed as acceptance gates.

Rev 2 content (Interaction Schema, 5 type tokens, 4 color tokens, 6 primitives, Governance canary mapping) stands unchanged and is not repeated here except where expanded.

---

## A. Section Open-State Visual Spec

The existing Section primitive renders the body inline with no visual signal that an expanded body belongs to its header. The body must earn a distinct open-state treatment so the parent-child relationship is legible without reading text.

### Visual specification (binding for Phase 2)

| Property | Value | Rationale |
|---------|-------|-----------|
| Body background | `color-mix(in oklch, var(--text-primary) 3%, transparent)` | Subtle tint; distinct from panel background but not loud. Ties to existing token (`--text-primary`) — no new token introduced. |
| Body border-left | `1px solid color-mix(in oklch, var(--text-accent) 40%, transparent)` | Parent-child signal. Accent-derived; stays confined to Section's internal treatment (does not violate the "accent only on CTAs" rule because it is a structural rule, not text color). |
| Body padding-left | `10px` | Indented relative to section header — reinforces parent-child. 10px because the header chevron + title combo uses 6px + 4px already, so 10px creates a visible inset without misaligning. |
| Body padding-top / padding-bottom | `8px` each | Content padding inside a section (tight). |
| Body padding-right | `12px` | Slightly looser on the right to let value columns breathe. |
| Gap between stacked Sections | `16px` | Between-section spacing must be strictly greater than content padding inside a section. `16px > 8px` enforces the airy-between / dense-inside rhythm. |
| Header background | unchanged | Only the body receives the tint; header stays flush with panel background so the "click target" stays visually continuous with the panel. |

### Why not a heavier tint / solid background?

A heavier tint would compete with `MithrilViolationCard` and `StatBadge` backgrounds (amber / red / semantic). A 3% primary-mix is strong enough to disambiguate at a glance but quiet enough to let the accent border do the parent-child work.

### Open Design Question (non-blocking)

**Q6 — Exact tint percentage.** 3% vs 4% vs 5% is within visual-check range. Phase 2 implements 3% as the binding default; Justin signs off during Phase 3 visual review. If 3% reads as too subtle at 320px, flip to 4% — this does not change any invariant (background must differ from panel, not by a specific magnitude).

---

## B. Properties Panel Canary Scope

### Files in scope

| File | LOC area | Current violations |
|------|---------|---------------------|
| `src/components/ui/PropertiesPanel.tsx` | 563 | 10 spacing-token font-sizes, 7 ad-hoc zinc text colors, 1 inline `uppercase` |
| `src/components/inspector/ClassBuilder.tsx` | — | 4 spacing-token font-sizes, 1 ad-hoc zinc |
| `src/components/inspector/primitives.tsx` | 289 | 8 spacing-token font-sizes, 3 ad-hoc zinc, **1 inline `uppercase` in the existing `Accordion` component** |
| `src/components/inspector/DriftDetector.tsx` | — | 10 spacing-token font-sizes, 5 ad-hoc zinc, 1 inline `uppercase` |
| `src/components/inspector/LayoutPanel.tsx` | — | 2 spacing-token font-sizes, 3 ad-hoc zinc, 1 inline `uppercase` |
| **Totals** | — | **34 / 19 / 4** |

### Accordion → Section migration (important)

`inspector/primitives.tsx` exports an `Accordion` component that duplicates the new `Section` primitive's role. `PropertiesPanel.tsx` currently wraps `NodeProperties` in `Accordion`. Phase 2 replaces every `Accordion` usage in the Properties-panel scope with `Section`, passing `expandedWhen` explicitly. `Accordion` is deleted from `primitives.tsx` once call sites migrate. This consolidates the collapse semantic behind one primitive.

### Properties-panel specific invariants (mirror Governance + one extra)

| Name | Threshold | Measured by |
|------|-----------|-------------|
| `properties-zero-spacing-font-size` | `= 0` | grep over `PropertiesPanel.tsx` + `inspector/*.tsx` |
| `properties-zero-adhoc-zinc-text` | `= 0` | grep over same scope |
| `properties-zero-inline-uppercase` | `= 0` | grep over same scope (Accordion-in-primitives is the chief offender — removed as part of migration) |
| `properties-schema-role-coverage` | every component carries a `schemaRole` | AST-lite grep |
| `properties-cta-primary-cap` | `= 0` (inspector panel has no CTA-primary — all actions are secondary / state-signal) | jsdom test counts `data-schema-role="cta-primary"` in rendered PropertiesPanel |
| `properties-accent-confined-to-cta` | `= 0` accent-text usage outside CTA subtrees | jsdom ancestry walk |
| `properties-accordion-eliminated` | `= 0` imports of `Accordion` from `inspector/primitives` in canary scope | grep |

### Rationale for `cta-primary-cap = 0` (not `<= 1`)

The Properties panel is an **inspector** — its job is to surface the properties of the selected node and let the user mutate them. Every visible action is a mutation applied through a store or an Auto-Fix button. None of them qualify as "the main thing for this panel state" — the panel itself has no unique top-level action. `MithrilViolationCard`'s "Auto-Fix" button is `cta-secondary` (it resolves a drift warning, it isn't the panel's headline action). This is the tightest interpretation of "CTA-primary cap ≤ 1" and is the right one for an inspector.

---

## Impact Map (rev 3 — expanded)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/index.css` | MODIFY | flint-design-engineer | [rev 2] Add `@theme` block: 5 `--text-*` size tokens + 4 text-color tokens + LH/weight companions. Keep `--spacing.*` defined (non-breaking). |
| `src/components/ui/primitives/Section.tsx` | MODIFY | flint-design-engineer | [rev 3] Add open-state visual treatment: body tint (`color-mix` 3% of `--text-primary`), 1px left-accent border (40% `--text-accent`), 10px left padding, 8/12px vertical padding, 16px between-section margin when stacked. |
| `src/components/ui/primitives/PropertyRow.tsx` | CREATE | flint-design-engineer | [rev 2] |
| `src/components/ui/primitives/FooterActionBar.tsx` | CREATE | flint-design-engineer | [rev 2] |
| `src/components/ui/primitives/MetadataTooltip.tsx` | CREATE | flint-design-engineer | [rev 2] |
| `src/components/ui/primitives/StatBadge.tsx` | CREATE | flint-design-engineer | [rev 2] |
| `src/components/ui/primitives/PanelTabLabel.tsx` | CREATE | flint-design-engineer | [rev 2] |
| `src/components/ui/primitives/__tests__/*.test.tsx` | CREATE | flint-test-writer | [rev 2] + new tests for 4 open-state invariants |
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY | flint-design-engineer | [rev 2] |
| `src/components/ui/governance/*.tsx` (~19 files) | MODIFY | flint-design-engineer | [rev 2] |
| `src/components/ui/governance/__tests__/canary-visual.test.tsx` | CREATE | flint-test-writer | [rev 2] |
| **`src/components/ui/PropertiesPanel.tsx`** | **MODIFY** | **flint-design-engineer** | [rev 3] Replace inline `uppercase`/spacing-font-sizes/ad-hoc zinc with primitives + tokens. Replace `Accordion` with `Section(expandedWhen)`. Tag every component with `schemaRole`. Zero cta-primary. |
| **`src/components/inspector/ClassBuilder.tsx`** | **MODIFY** | **flint-design-engineer** | [rev 3] Same invariants. `MithrilViolationCard`'s Auto-Fix becomes `cta-secondary`. |
| **`src/components/inspector/DriftDetector.tsx`** | **MODIFY** | **flint-design-engineer** | [rev 3] Same invariants. "ΔE<2 auto-fixable" legend is `metadata` role. |
| **`src/components/inspector/LayoutPanel.tsx`** | **MODIFY** | **flint-design-engineer** | [rev 3] Axis labels (W / H / section titles) use `PanelTabLabel` where uppercase; spacing-font-sizes replaced. |
| **`src/components/inspector/primitives.tsx`** | **MODIFY** | **flint-design-engineer** | [rev 3] Delete `Accordion` once call sites migrate. Update `TokenAutocomplete`, `CompactSelect`, `ColorPickerSwatch`, `PopoverPicker` to use tokens + tags. |
| **`src/components/ui/__tests__/properties-canary.test.tsx`** | **CREATE** | **flint-test-writer** | [rev 3] Visual regression + schema-role coverage + CTA-primary === 0 + accent-confined + Section open-state invariants fire at 320px. |

No changes to: `electron/**`, `server/**`, `flint-mcp/**`, `shared/**`, `demo/**`, `design-tokens.json`, panels outside the two canary scopes.

## Section Open-State Invariants (4 new)

| Name | Measurable | Threshold | Measured By |
|------|-----------|-----------|-------------|
| `section-open-state-background-distinct` | `getComputedStyle(body).backgroundColor` on an expanded `<Section>` body differs from the enclosing panel's backgroundColor | `strictly different RGB values` | jsdom test renders a Section inside a panel and compares computed backgrounds |
| `section-open-state-left-border` | `getComputedStyle(body).borderLeftWidth` on an expanded Section body | `>= 1px` | jsdom |
| `section-open-state-indented` | `getComputedStyle(body).paddingLeft` on an expanded Section body | `>= 10px` | jsdom |
| `between-section-spacing-greater-than-inside-section` | Gap between two stacked Sections vs. content padding inside one Section | `outer margin >= 2 * inner padding-top` (16 vs 8) | jsdom renders two stacked Sections and measures offsetTop delta minus header height |

## Commandment Checklist (rev 3 unchanged from rev 2)

| # | Commandment | How this contract satisfies it |
|---|-------------|-------------------------------|
| 2 | No Hallucinated Styling | Every visual value in both canary scopes routes through a declared `@theme` token. Open-state tint uses `color-mix` of existing tokens — no new tokens introduced. |
| 13 | Deterministic Surgery | Dev-time UI refactor; determinism from TSC + Vitest. |
| 14 | Bypass Prohibition | Pure renderer refactor. |

## Parallelism Groups (rev 3 expanded)

| Group | Agents | Runs when | Scope |
|-------|--------|-----------|-------|
| A | flint-design-engineer | First | `src/index.css` @theme block |
| B | flint-design-engineer, flint-test-writer | After A | 6 primitives + tests, **including Section open-state visual treatment and its 4 new invariant tests** |
| C | flint-design-engineer, flint-test-writer | After A + B | Governance canary refactor + canary-visual test |
| **D (NEW)** | **flint-design-engineer, flint-test-writer** | **After A + B. Parallel with C.** | **Properties canary refactor + properties-canary test. Independent file scope from Governance, shares only the primitive library which B already produced.** |
| E | flint-code-reviewer, flint-integration-validator | After C + D | End-of-round review ceremony |

**Group D is parallel with Group C.** Governance and Properties canaries touch disjoint file sets. The only shared dependency is the primitive library from Group B, which is complete before either starts.

## Non-Goals (rev 3)

Carried forward from rev 2, with one relaxation:

1. **REMOVED for Properties specifically:** "no other panel migration" — Properties panel joins Governance in the canary scope.
2. **Still in force for all other panels:** Tokens tab, Assets panel, StatusBar, ExportModal, ComponentPanel, Command Palette, App chrome. These stay on legacy `--spacing.*` vars until GLASSTYPO.2+.
3. Everything else from rev 2 non-goals stands unchanged (no font-family changes, no letter-spacing tokens beyond 0.06em, no MCP surface, no StatusBar redesign, no codemod).
4. **NEW:** No migration of `Accordion` usages outside the Properties canary scope. The `Accordion` export stays deleted only if every call site is inside the canary — Phase 2 verifies this. If a non-canary call site exists, `Accordion` stays until its owning panel migrates.

## Open Design Questions (rev 3)

1. **Q6 — Exact open-state tint percentage.** Phase 2 ships 3%. Justin signs off in Phase 3 visual review at 320 / 360 / 400px. Not load-bearing for invariants.
2. **Q7 — Accordion deletion in primitives.tsx.** If Phase 2 finds a non-canary call site (ComponentPanel, ExportModal, etc.), the file is kept and only canary call sites migrate. Phase 2 grep determines. Does not affect contract invariants.

Both questions are non-blocking — Phase 2 can proceed.

## Risks (rev 3 additions)

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Properties panel + Governance panel both touching primitives and tokens creates a merge conflict window | medium | Group B lands primitives first; Groups C and D branch from the post-B commit. Flint-git-guru sequences. |
| `color-mix(in oklch, ...)` not supported in jsdom's CSS engine | medium | Test asserts via `getComputedStyle` with a tolerance; fallback is a resolved rgba that jsdom accepts. Phase 2 implementer confirms during Group B. |
| `Accordion`-to-`Section` migration drops the `defaultOpen={false}` used by `NodeProperties` — needs an `expandedWhen` equivalent | low | `<Section expandedWhen={() => false}>` is the binding default for passive Element-Properties; user can still click to open. |
| Properties panel has zero CTA-primary — some reviewers may read that as "no primary action exists" | low | Documented in rev 3 as the correct interpretation of an inspector. Surfaced in Phase 3 review. |

---

## Status: APPROVED — rev 3 expansion is fully specified. No blocking open questions. Ready for Phase 1.5 lint.
