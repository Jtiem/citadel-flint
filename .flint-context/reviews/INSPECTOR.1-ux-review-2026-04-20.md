# INSPECTOR.1 — UX Review

- **Phase:** INSPECTOR.1 — Context-Aware Properties Panel
- **Reviewer:** flint-ux-critic
- **Date:** 2026-04-20
- **Round:** 1
- **Verdict:** REVISE

## What I tested

- Tag → section mapping for all 24 registered tags + `<div>`/`<span>`/capitalized component fallback.
- Auto-expand behavior per bucket (Text, Container, Media, Interactive, Form, Generic).
- Off-token warning rendering on `text-[17px]`, `p-[13px]`, token hit (`text-lg`), and null value paths in `TypographySection`.
- `<img alt="">` critical flag vs. decorative-image intent.
- Auto-tab-switch null→id, id→id', id→null transitions and manual-override gating in `useAutoTabSwitch`.
- Ambiguous-element fallback surface (`<div>`, `<span>`, capitalized `Card`).

## Gut read

The context-awareness **works at the registry layer**: selecting an `<h1>` resolves to Typography-first, `<img>` to MediaProps, `<input>` to FormProps. The mapping feels Figma-correct for the 24 named tags. But two implementation gaps break the promised experience:

1. **Auto-expand is not wired.** The registry says "only the primary section opens"; the components hardcode `expandedWhen={() => true}` on every Section. In practice, every relevant section is expanded on first render. This silently violates contract invariant #4 and ODQ-3 (Justin explicitly picked primary-only).
2. **Focus-steal cooldown is missing.** The review request describes a 3-second cooldown; the hook has none. Only a boolean override flag exists. This may be fine, but it diverges from stated behavior and means rapid selection changes immediately after a manual tab click will auto-switch if `userOverrodeTab` hasn't been set yet.

The rest — registry coverage, off-token flagging, empty-alt surface — is solid. This review asks for two targeted fixes, not a redesign.

---

## Findings

### F1 — Auto-expand registry is not enforced at render (HIGH)

**Observed:** Every inspector section in Group B passes `expandedWhen={() => true}` to its `Section` primitive (see `TypographySection.tsx:159`, `MediaPropsSection.tsx:154`, `FormPropsSection.tsx:66`). `A11ySection.tsx:117` uses `expandedWhen={() => nodeViolations.length > 0}`. None of them consult `getAutoExpandedSections(tagName)`.

**Rationale:** The contract invariant `auto-expand-matches-registry` (INSPECTOR.1-contract.md:157) requires expanded sections === `getAutoExpandedSections(tag)` exactly. Justin's ODQ-3 answer explicitly chose "primary section only" to "reduce visual churn on selection." Current behavior opens every relevant section, which re-introduces the churn that ODQ-3 was designed to eliminate. For an `<h1>`, Typography + Layout + A11y + NodeProperties all open together — identical to the old generic inspector, minus the suppressed buckets.

**Fix:** `PropertiesPanel` should pass an `initiallyExpanded: boolean` prop to each inspector section (derived from `getAutoExpandedSections(layer.tagName).includes(sectionName)`), and each section should pass it to `Section` via `expandedWhen={() => initiallyExpanded}` or equivalent first-render-only signal.

### F2 — "3-second focus-steal cooldown" described in review prompt is not implemented (MEDIUM)

**Observed:** `useAutoTabSwitch.ts:36-49` gates solely on `userOverrodeTab`; there is no time-based cooldown. The hook switches tabs on every null→id transition unless the override flag is already set.

**Rationale:** The review request asks me to evaluate whether 3 seconds is the right cooldown duration. The contract (INSPECTOR.1-contract.md:55, Non-Goal #6) specifies session-scoped override — no cooldown was ever contracted. Two possible states: (a) the cooldown was dropped deliberately but the review prompt is stale, or (b) the cooldown was intended and got lost. Either way, user-facing behavior diverges from what Justin was told to evaluate. Recommendation: **don't add a cooldown.** The override flag is the simpler, more predictable model — if the user clicked Tokens, leave them in Tokens until they clear selection. Time-based logic would make the tab "unstick itself" mid-workflow, which is worse than both alternatives.

**Fix:** Update review prompt and HANDOFF.md to remove the cooldown reference, OR add a 3s guard if Justin wants it. My recommendation: keep the boolean-only model.

### F3 — Empty `alt=""` flagged as critical conflicts with decorative-image semantics (MEDIUM)

**Observed:** `MediaPropsSection.tsx:91-95` renders `<StatBadge variant="critical">empty alt</StatBadge>` whenever `alt === ''`. The tooltip at line 53 correctly acknowledges decorative-image intent, but the badge color/severity says "broken."

**Rationale:** WCAG 2.1 treats `alt=""` as **valid and required** for decorative images (H67). Flagging it critical conflicts with correct a11y practice and will generate false-positive warning fatigue in image-heavy surfaces (hero compositions, icon lockups, Figma-imported illustrations). This contradicts Warden's own convention elsewhere — Warden rule `img-alt` distinguishes "missing alt" (critical) from "empty alt" (informational).

**Fix:** Downgrade empty-alt to `variant="warning"` with label "decorative?" and surface the tooltip inline. Reserve `critical` for fully-missing `alt` attribute (i.e., `alt === undefined`, which currently is filtered out by the `rawValue === undefined` guard at line 74 — meaning the critical path is **only** firing for empty strings, which is the wrong trigger).

### F4 — Generic fallback for `<div>`/`<span>`/capitalized components shows Typography on container-like elements (LOW)

**Observed:** `elementTypePropertyMap.ts:91-94` — the generic fallback renders `['Typography', 'Layout', 'Appearance', 'A11y', 'NodeProperties']`. A `<div>` goes through `CONTAINER_TAGS` (line 50) so it gets the container bucket — correct. But capitalized components (`<Card>`, `<UserAvatar>`) and unknown lowercase tags fall to `GENERIC_SECTIONS`, which includes Typography. Most custom components are containers; surfacing typography-first rows adds noise.

**Rationale:** ODQ-4 answer was "full inspector, all collapsed — `<div>` is semantically neutral, narrowing would hide real controls." That reasoning is sound for `<div>`, but `<div>` is not the fallback — it's in `CONTAINER_TAGS`. The true fallback consumers are custom components, which are 90%+ containers in practice. Typography at position 0 of the generic list means users scroll past an empty Typography section for every capitalized component.

**Fix:** Reorder generic sections to `['Layout', 'Appearance', 'Typography', 'A11y', 'NodeProperties']`. All-collapsed still holds; just rank container-shaped sections first. Alternatively, adopt a "container-biased" fallback bucket that matches CONTAINER_SECTIONS.

### F5 — Off-token warning badge text says what's wrong but not what to do (LOW)

**Observed:** `TypographySection.tsx:179-181` renders `<StatBadge variant="warning" compact>off-token</StatBadge>`. No tooltip, no suggested token name, no next action. `result.nearestTokenName` is available from `matchValueToToken` but only used on the on-token branch (line 189).

**Rationale:** Justin ask #3 required the raw value be displayed AND flagged. Current implementation does both, but "off-token" is a diagnosis, not guidance. Users see `17px [off-token]` and must reason about which token to switch to. The nearest-token information is already computed (`result.nearestTokenName`) and discarded on the off-token branch.

**Fix:** When off-token, render secondary hint: `17px [off-token • closest: text-lg (16px)]` or tooltip on the badge with the same copy. This closes the loop between "flag the problem" and "tell me the fix."

### F6 — Every section title is a generic "primary-content" role, making the auto-expanded section visually indistinguishable (LOW)

**Observed:** All four new inspector sections pass `schemaRole="primary-content"` to their `Section` primitive. The one that got auto-expanded by the registry has no visual differentiation from the others (once F1 is fixed).

**Rationale:** Once F1 lands, the "primary" section will be the open one and the rest collapsed — differentiation will exist structurally. But in the current shipped state, everything is open and everything is primary-content, so the user's eye has no anchor. Fixing F1 resolves this incidentally.

**Fix:** No separate action needed if F1 is addressed.

---

## Scope Coverage

**Reviewed:**
- `src/core/elementTypePropertyMap.ts` (full)
- `src/hooks/useAutoTabSwitch.ts` (full)
- `src/components/inspector/TypographySection.tsx` (full)
- `src/components/inspector/MediaPropsSection.tsx` (full)
- `src/components/inspector/FormPropsSection.tsx` (full)
- `src/components/inspector/A11ySection.tsx` (full)
- INSPECTOR.1 contract + ODQ answers

**Skipped:**
- `PropertiesPanel.tsx` dynamic-section assembly — not provided in scope files, but F1 is the integration gap most likely to live there.
- `tokenMatcher.matchValueToToken` — pure utility, covered by unit tests per contract.
- `canvasStore.userOverrodeTab` slice — trivial boolean, not UX-facing.
