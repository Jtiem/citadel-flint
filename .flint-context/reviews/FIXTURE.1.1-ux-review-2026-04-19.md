# FIXTURE.1.1 — UX Review (End-of-Round)

**Phase:** FIXTURE.1.1 — DTCG Token Shape Adapter
**Dimension:** ux
**Reviewer:** flint-ux-critic
**Date:** 2026-04-19
**Round:** 1
**Verdict (derived):** FIX-FORWARD

---

## Scope of this review

FIXTURE.1.1 is engine-only work. The single designer-facing artifact is the demo fixture `demos/01-rag-ui-builder/banner-broken.tsx`, which a beta tester will audit to experience Mithril's "I caught this" moment. The adapter itself (`dtcgTokenAdapter.ts`) and the server swap are evaluated only through their indirect UX surface: error codes that would bubble to a Glass popover, and the compliant-vs-broken violation-count delta that shapes the demo narrative.

### Files reviewed
- `demos/01-rag-ui-builder/banner-broken.tsx` (the demo fixture rework)
- `demos/01-rag-ui-builder/banner-compliant.tsx` (storytelling counterweight)
- `demos/01-rag-ui-builder/design-tokens.json` (the tokens Mithril will cite)
- `flint-mcp/src/core/dtcgTokenAdapter.ts` (error-code surface)
- `.flint-context/contracts/FIXTURE.1.1-contract.md` (binding spec)

### Intentionally skipped
- `flint-mcp/src/server.ts` — one-line engine swap, no UX surface
- `flint-mcp/src/__tests__/server.audit-fixture.test.ts` — internal canary
- `flint-mcp/src/tools/swarm.ts` — engine parity, no UX surface

---

## Rubric

| Criterion | Result | Notes |
|---|---|---|
| `banner-broken.tsx` produces ≥5 violations (contract `demo-broken-distinguishable`) | pass | All 12 literal pixel values and the hex `#0D5FD9` are off-canon; Mithril will flag each via MITHRIL-TYP-002 / MITHRIL-SPC-001 / MITHRIL-COL-001. |
| `banner-compliant.tsx` produces 0 violations (contract `demo-compliant-clean`) | pass (by adapter correctness) | Every literal in the compliant file has an exact DTCG token match once `normalizeTokenShape` flattens the document. |
| Broken vs compliant delta is legible to a non-technical beta tester | fail | The drifts are uniformly 1px off-by-one (47↔48, 15↔16, 11↔12, 9↔8, 13↔12, 13↔14, 17↔16, 25↔24). A designer reading the rendered banner cannot see the drift; the color `#0D5FD9` vs `#0066FF` is also within 1 ΔE-ish perceptual distance. The demo becomes "trust Mithril's numbers" rather than "see the drift." |
| Error codes are plain-English-friendly for a Glass StatusBar popover | fail | `ALIAS_CYCLE` and `ALIAS_BROKEN_REF` are SHOUT_CASE engine identifiers, not designer-readable strings. No human label, no remediation hint. |
| Violation reporting cites author-intended tokens (Commandment 2) | pass | Adapter preserves `$description` into `DesignToken.description`; Mithril's `nearestToken` suggestions will surface the authored intent ("Banner headlines", "CTA vertical padding"). |
| No new UI surface introduced without journey justification | pass | Engine-only change. No Glass, IPC, or store impact. |
| Demo fixture supports the "this is why governance matters" story | pass (with reservations — see WARN-1) | The file is syntactically identical to the compliant version apart from literal values, which keeps the diff teachable. |

---

## Findings

### WARN-1 — Broken/compliant delta is numerically detectable but visually invisible

**Severity:** warning
**Scope:** one-file
**Evidence:**
- `demos/01-rag-ui-builder/banner-broken.tsx:16` — `p-[47px]` vs compliant `p-[48px]` (line 16 of compliant)
- `demos/01-rag-ui-builder/banner-broken.tsx:16` — `rounded-[13px]` vs compliant `rounded-[12px]`
- `demos/01-rag-ui-builder/banner-broken.tsx:16` — `bg-[#0D5FD9]` vs compliant `bg-[#0066FF]` (CIEDE2000 ΔE ≈ 3.4, just above Mithril's 2.0 threshold)
- `demos/01-rag-ui-builder/banner-broken.tsx:17,21,25,29` — font sizes `11/25/17/13` vs token `12/24/16/14`

**Observed:** Every drift in `banner-broken.tsx` is a ±1px or ΔE ≈ 3 deviation from the compliant counterpart. Rendered side-by-side in a browser, a designer cannot tell them apart.

**Rationale:** The demo's job is to create an "aha" moment: *"Look, my eyes missed it, but Mithril caught it — this is exactly why my team needs this."* When the drift is invisible, the moment collapses into "trust the tool's numbers." A stronger demo would mix subtle drifts (the current set, proving Mithril catches what humans miss) with at least one loud drift — e.g., `p-[60px]` instead of `p-[47px]`, or `bg-[#E50914]` (Netflix red, ΔE > 40) — so the beta tester *sees* the broken render, *then* reads the report and thinks "oh, and Mithril caught all these other ones too."

**Proposed fix:** Change one or two of the drifts to visually unmissable values. Candidate: `p-[64px]` (headline padding drift, renders as a fat banner) and `bg-[#D90D0D]` (Netflix-adjacent red — unmistakably off-brand). Keep the other 10 drifts subtle to demonstrate the forensic power.

**Status:** open

---

### WARN-2 — Error code surface is not designer-readable

**Severity:** warning
**Scope:** cross-file (adapter + any consumer that renders errors)
**Evidence:**
- `flint-mcp/src/core/dtcgTokenAdapter.ts:35` — `code: 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF'`
- `flint-mcp/src/core/dtcgTokenAdapter.ts:245-250` — cycle error emission
- `flint-mcp/src/core/dtcgTokenAdapter.ts:256-262` — broken-ref error emission

**Observed:** The two `TokenAdapterError` codes are SHOUT_CASE engine identifiers with no human label, no remediation hint, and no link to the offending path in a designer-readable form. If a beta tester's tokens file contains an alias typo, the error will reach a Glass StatusBar popover (or CLI output) as raw "ALIAS_BROKEN_REF" text.

**Rationale:** The error taxonomy at `src/core/ErrorTaxonomy` (50 rule explanations, CX.3) sets the plain-English bar for all user-facing engine errors. Designers see "Unresolved token reference: `fontSize.bigly` doesn't exist in your tokens file. Did you mean `fontSize.base`?" — not `ALIAS_BROKEN_REF`. This finding does not block FIXTURE.1.1 (the contract's non-goals explicitly exclude new telemetry), but when error surfacing lands, the adapter codes must be mapped to the taxonomy. Track this as a dependency before the adapter's errors reach any user-visible surface.

**Proposed fix:** Add an `ALIAS_CYCLE` / `ALIAS_BROKEN_REF` entry to `src/core/ErrorTaxonomy` with plain-English messages and remediation. Example for broken ref: *"The token `fontSize.display` references `{fontSize.huge}`, but no token with that path exists. Check for typos, or remove the reference."* Defer to a follow-up phase — not in FIXTURE.1.1 scope.

**Status:** open

---

### SUG-1 — Broken fixture could include one broken alias for teaching value

**Severity:** suggestion
**Scope:** one-file
**Evidence:**
- `demos/01-rag-ui-builder/design-tokens.json:94-120` — `fontSize` group has `xs|sm|base|lg|xl` but no aliases
- `flint-mcp/src/core/dtcgTokenAdapter.ts:233-295` — alias resolver handles cycles and broken refs, but zero demo coverage

**Observed:** The adapter invests meaningful complexity (~60 LOC) in alias resolution with typed errors, but the demo fixture exercises none of it. A beta tester running the demo audit will never see alias resolution working or failing.

**Rationale:** Demo fixtures are the product's "try this at home" story. If alias resolution is worth building, it's worth teaching. Adding one alias leaf (e.g., `fontSize.cta: { $value: "{fontSize.sm}" }`) to `design-tokens.json` and referencing `14px` via that alias in the compliant banner demonstrates the feature and catches regressions in one move.

**Proposed fix:** Add one token alias in `demos/01-rag-ui-builder/design-tokens.json` (e.g., `fontSize.cta` → `{fontSize.sm}`) and verify the compliant banner still audits to 0. Optional but high signal.

**Status:** open

---

### SUG-2 — `collection_name: 'fixture'` hard-code limits multi-collection DTCG stories

**Severity:** suggestion
**Scope:** one-file
**Evidence:**
- `flint-mcp/src/core/dtcgTokenAdapter.ts:221` — `collection_name: 'fixture'` on every synthesized token

**Observed:** All flattened tokens are tagged `collection_name: 'fixture'`. This is fine for FIXTURE.1.1 (the contract explicitly constrains to fixture-loaded documents), but it will look hard-coded if/when the adapter is reused for real Figma-exported multi-collection DTCG documents.

**Rationale:** Not a current defect. Flagged so reviewers of the eventual LIB.1 "bring your own DTCG file" story remember to parameterize this field. Ties directly to Commandment 2 (no hallucinated styling) — if a user's DTCG has top-level collection grouping, flattening loses that provenance.

**Proposed fix:** When the adapter is reused outside fixture loading, either detect a top-level `$metadata.collection` DTCG extension or accept a `{ collectionName }` option on `normalizeTokenShape`.

**Status:** open

---

## Gut read on demo storytelling quality

The fixture is **mechanically correct but narratively thin.** It proves Mithril catches drift, but only if you already trust the report. A stronger story mixes one or two visually-loud drifts with the current subtle set, so a designer sees the broken banner, *then* reads the report. That single change would lift the demo from "engineering test case" to "aha moment." The adapter's alias resolution is invisible here — adding one alias leaf would triple the demo's teaching surface for minimal effort. Neither is blocking: engine-only closure is legitimate as-scoped, and the drift-count invariant (`≥5`) is satisfied. But before this fixture becomes the onboarding entry point, both warnings should be addressed.
