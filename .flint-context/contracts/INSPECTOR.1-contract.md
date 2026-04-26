# INSPECTOR.1 — Context-Aware Properties Panel

**Status:** APPROVED (2026-04-20 — Justin accepted all 5 ODQ recommendations: TS registry, shared tokenMatcher, primary-only auto-expand, full/collapsed for ambiguous elements, session-only override persistence)
**Owner:** flint-architect
**Date:** 2026-04-19 (approved 2026-04-20)
**Audience:** designer
**Depends on:** GLASSTYPO.1 (APPROVED + shipped, commit `ed80f89`)

---

## Summary

When a node is selected on the canvas, the right sidebar should (a) auto-switch to the Properties tab (unless the user deliberately left it), (b) show only the property categories relevant to that element type, (c) surface raw off-token values inline with a warning badge instead of silently displaying them as if they were tokens. This phase wires those three behaviors through the existing primitives + selection plumbing. No new stores, no new IPC, no new MCP surface.

## Confirmed Plumbing (investigation results)

| Question | Answer (from code) |
|---|---|
| Selection change signal | `canvasStore.activeSelection` (set on `CANVAS_CLICK`) with fallback to `editorStore.selectedNodeId` (set by Layer Tree). `PropertiesPanel` already reads `effectiveId = activeSelection ?? selectedNodeId`. |
| Element type source | `VisualLayer.tagName` (from `src/core/ast-parser.ts`). Already used by `getIconForTag()` in `PropertiesPanel.tsx`. |
| Right-sidebar tab state | `canvasStore.rightTab: RightTab` (`'governance' \| 'properties' \| 'tokens'`) + `setRightTab(tab)`. Already used by ShieldOverlay click-to-properties. |
| Token matching | `src/utils/tokenMatcher.ts` (`findClosestToken`) + `src/utils/astScanner.ts` (`scanArbitraryColors`). Already Glass-side, pure TypeScript, reused by `MithrilLinter.ts` and `DriftDetector.tsx`. **Architecturally correct integration = Option 3: shared pure-function module (already exists).** We extend the scanner to cover typography/spacing/sizing utilities, not just colors. |

## Impact Map

| File | Change | Owner | Summary |
|---|---|---|---|
| `src/core/elementTypePropertyMap.ts` | CREATE | flint-state-architect | Pure-function registry: `getRelevantSections(tagName)` + `getAutoExpandedSections(tagName)`. 24 element types mapped + generic fallback. No store, no IPC. |
| `src/core/__tests__/elementTypePropertyMap.test.ts` | CREATE | flint-test-writer | Matrix test: every element type returns correct section set; unknown tag → generic fallback. |
| `src/utils/tokenMatcher.ts` | MODIFY | flint-state-architect | Add `matchValueToToken(value, category)` helper that wraps existing `findClosestToken` for non-color categories (typography/spacing). Pure addition, no signature changes. |
| `src/utils/astScanner.ts` | MODIFY | flint-ast-surgeon | Extend `scanArbitraryColors` → add `scanArbitraryTypography`, `scanArbitrarySpacing`. Same Babel traversal pattern, new regex classes. |
| `src/hooks/useAutoTabSwitch.ts` | CREATE | flint-state-architect | Hook that watches `activeSelection`; on transition null→id, calls `setRightTab('properties')` unless `userOverrodeTab === true`. Resets override on deselect. |
| `src/store/canvasStore.ts` | MODIFY | flint-state-architect | Add `userOverrodeTab: boolean` + `markTabOverridden()` + reset in `setActiveSelection(null)`. No schema changes beyond this flag. |
| `src/components/ui/PropertiesPanel.tsx` | MODIFY | flint-design-engineer | Replace single "Element Properties" Section with N dynamic Sections sourced from `getRelevantSections(tagName)`. Each Section uses `expandedWhen` from `getAutoExpandedSections`. Off-token inputs wrapped in `<StatBadge variant="warning">` when value fails `matchValueToToken`. |
| `src/components/inspector/TypographySection.tsx` | CREATE | flint-design-engineer | New inspector section: font-family, weight, size, line-height, letter-spacing, color rows. Each row reads className/style, badges off-token values. |
| `src/components/inspector/FormPropsSection.tsx` | CREATE | flint-design-engineer | Inspector section for input/textarea/select: name, value, placeholder, type. |
| `src/components/inspector/MediaPropsSection.tsx` | CREATE | flint-design-engineer | Inspector section for img/video: src, alt, object-fit. |
| `src/components/inspector/A11ySection.tsx` | CREATE | flint-design-engineer | Inspector section for aria-label, role, tabIndex. Visible for all interactive element types. |
| `src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx` | CREATE | flint-test-writer | Element-type matrix test + off-token badge test + auto-tab-switch test + manual-override test. |
| `src/components/inspector/__tests__/TypographySection.test.tsx` | CREATE | flint-test-writer | Off-token flag present/absent scenarios. |
| `src/hooks/__tests__/useAutoTabSwitch.test.ts` | CREATE | flint-test-writer | null→id switches to properties; id→id' keeps properties; manual override blocks switch; deselect resets override. |

## IPC Channels

_None._ INSPECTOR.1 is pure renderer-side composition over existing state.

## Store Contracts

| Store | New State | New Actions | New Selectors |
|---|---|---|---|
| `canvasStore` | `userOverrodeTab: boolean` (default `false`) | `markTabOverridden()` | — |

`setRightTab` is unchanged. The hook calls `setRightTab('properties')` defensively; `markTabOverridden` is called from the tab bar click handler in `App.tsx` (a 1-line change) when the user clicks a non-Properties tab while a node is selected.

## Component Contracts

| Component | Props | Store deps | IPC |
|---|---|---|---|
| TypographySection | `{ layer: VisualLayer; onCommit: (className: string) => void }` | tokenStore (read) | — |
| FormPropsSection | `{ layer: VisualLayer; onCommitProp: (name, value) => void }` | — | — |
| MediaPropsSection | `{ layer: VisualLayer; onCommitProp: (name, value) => void }` | — | — |
| A11ySection | `{ layer: VisualLayer; onCommitProp: (name, value) => void }` | — | — |

## Element-Type Registry Outline

24 types mapped, 5 categorical buckets + generic fallback:

| Bucket | Tags | Sections rendered (auto-expanded in **bold**) |
|---|---|---|
| Text | `h1`–`h6`, `p`, `span`, `label`, `strong`, `em` | **Typography**, Layout (margin), A11y, NodeProperties |
| Container | `section`, `article`, `main`, `aside`, `nav`, `div`, `header`, `footer` | **Layout**, Appearance, A11y, NodeProperties |
| Media | `img`, `video`, `picture`, `svg` | **MediaProps**, Layout (dimensions), A11y (alt), NodeProperties |
| Interactive | `button`, `a` | **Typography**, Layout (padding), A11y, NodeProperties |
| Form | `input`, `textarea`, `select` | **FormProps**, Typography, A11y (label assoc.), NodeProperties |
| _Unknown / capitalized component_ | fallback | Layout, Typography, Appearance, A11y, NodeProperties (all collapsed) |

Output signature:

```ts
export function getRelevantSections(tagName: string): Section[]
export function getAutoExpandedSections(tagName: string): Section[]
export type Section = 'Typography' | 'Layout' | 'Appearance' | 'MediaProps' | 'FormProps' | 'A11y' | 'NodeProperties'
```

## Off-Token Flagging — Shared Module Path

**Integration: Option 3 (shared pure-function module, already exists).**

`src/utils/tokenMatcher.ts::findClosestToken` is already the single source of truth. `MithrilLinter.ts` imports it; `DriftDetector.tsx` imports it. This phase adds `matchValueToToken(value, category)` to the same file as a thin typed wrapper, and extends `src/utils/astScanner.ts` to scan typography/spacing utilities. No duplication. A grep-based invariant enforces "no parallel implementation."

Rationale: Glass already owns the CIEDE2000 implementation for latency (sub-ms per input render). IPC to MCP would add ~10ms per keystroke. Duplicating in a separate helper would risk drift. Extending the shared module is the only option that satisfies Commandment 13 (Deterministic Surgery) and the "reuse Mithril" directive.

## Commandment Checklist

| # | Applies? | How this phase satisfies it |
|---|---|---|
| 2 (No Hallucinated Styling) | Yes | Off-token badge makes hardcoded values visible, not silently normalized. Every chipped value tied to a named token. |
| 7 (ID Preservation) | Yes (indirectly) | All commits still route through `applyBatch` — no new write paths. |
| 12 (Atomic Queuing) | Yes | Unchanged — `handleCommit` continues through `editorStore.applyBatch`. |
| 13 (Deterministic Surgery) | Yes | Element-type detection reads `VisualLayer.tagName` from Babel AST parse. Value scanning uses existing Babel-based `astScanner.ts`. Registry is pure TypeScript data. **No regex on source code.** |

Commandments 1, 3–6, 8–11, 14–16 are not touched by this phase.

## Implementation Order & Parallelism Groups

| Group | Agents | Tasks |
|---|---|---|
| **A** (scaffold, parallel) | flint-state-architect | `elementTypePropertyMap.ts` + test, `canvasStore` `userOverrodeTab` slice, `useAutoTabSwitch` hook + test |
| **A'** (parallel with A) | flint-ast-surgeon | Extend `astScanner.ts` with typography/spacing scanners; extend `tokenMatcher.ts` with `matchValueToToken` |
| **B** (depends on A + A') | flint-design-engineer | Build 4 new inspector sections (`TypographySection`, `FormPropsSection`, `MediaPropsSection`, `A11ySection`) |
| **C** (depends on B) | flint-design-engineer | Integrate in `PropertiesPanel.tsx` — replace single Section with dynamic list from registry |
| **D** (parallel with C) | flint-test-writer | Component matrix tests, off-token badge tests, hook tests |
| **E** | flint-code-reviewer, flint-integration-validator | `/review` + Phase 3 integration validation |

## Risks

| Risk | Severity | Threatens | Mitigation |
|---|---|---|---|
| Registry becomes a bottleneck — every new element type requires a code change | Medium | Commandment 2 (silently wrong) | Unknown tag falls back to generic inspector (all sections, all collapsed). Extension is additive, not blocking. |
| Off-token scanner misses a utility class pattern → false "everything's fine" | High | Commandment 2 | Test boundary: feed known-bad className (`text-[17px]`, `p-[13px]`) and assert badge renders. Invariant: scanner coverage matches Mithril rule coverage (grep check). |
| Auto-tab-switch feels intrusive when user is mid-flow in Tokens tab | Medium | Designer UX | `userOverrodeTab` flag — manual switches stick. Deselection clears the override. |
| `matchValueToToken` for typography introduces new matching logic that drifts from MithrilLinter's rules | High | Commandment 13 | Wrapper MUST import from `tokenMatcher.ts` — grep invariant asserts zero standalone CIEDE2000 implementation in any new file. |
| `expandedWhen` predicates for auto-expand vs. collapsed sections conflict with GLASSTYPO.1 Rev 3 rule ("expand when actionable lever") | Low | GLASSTYPO.1 contract | Every section in the registry IS actionable (contains editable inputs). Passive-info sections don't exist in this phase. |
| Capitalized-component heuristic misclassifies lowercase custom elements | Low | Unknown-tag fallback | Fallback is the generic inspector — graceful degradation. |

## Non-Goals

1. No changes to `canvasStore.activeSelection`, `editorStore.selectedNodeId`, or any AST write path. Inspector is read-only wrt selection plumbing.
2. No new MCP tool, resource, or prompt.
3. No new token category (typography tokens already exist in `tokenStore`; we only consume).
4. No custom-component user-registration API (e.g., "user declares their `Card` component maps to X sections"). Registry is static in this phase; extensibility is a future phase.
5. No changes to `MithrilLinter.ts` — we consume its resolver, we don't modify it.
6. No cross-session persistence of `userOverrodeTab`. Override is session-scoped.
7. No auto-expansion of more than one section per element type beyond what the registry declares. ODQ-3 defers multi-expand rule to Phase 2 only if Justin opts in.
8. No keyboard shortcut to toggle "relevant-only" vs. "show all sections." Deferred.
9. No changes to LayoutPanel, ClassBuilder, DriftDetector, or AnnotationList internals — they remain composed unchanged.
10. No changes to `electron/`, `server/`, `flint-mcp/`, `shared/`.

## Open Design Questions (for Justin)

| # | Question | Recommendation |
|---|---|---|
| 1 | **Registry location/format?** `src/core/elementTypePropertyMap.ts` (TypeScript data) vs. `src/config/*.json` (designer-editable later) | TypeScript for v1 — type-safe, colocated with its only consumer. Promote to JSON when we have a "Designer customizes inspector" feature. |
| 2 | **Token-match integration path?** (1) Glass-side duplicate resolver, (2) IPC to MCP, (3) shared pure-function module | **Option 3** — already exists in `src/utils/tokenMatcher.ts`. We extend it rather than duplicate/relay. |
| 3 | **Auto-expand rule?** All relevant sections expanded vs. only the most-likely-to-edit one (e.g., Typography for `<h1>`) | Only the primary one (bold column in the table above). Reduces visual churn on selection. All others one-click reachable. |
| 4 | **Ambiguous elements (`<div>`, `<span>`) default?** Compressed view (Layout only) vs. full inspector | Full inspector, all collapsed. `<div>` is semantically neutral — narrowing would hide real controls. |
| 5 | **Manual tab override persistence?** Session only vs. localStorage cross-session | Session only. Cross-session persistence of a UI-preference flag needs a broader "Inspector Preferences" story. |

Justin's answers become binding; contract rev-2 will tighten `meta.status` to `APPROVED` and update invariants accordingly.

## Invariants (selected — see `.contract.ts` for full set)

1. `auto-tab-switch-on-selection` — null→id transition sets `rightTab === 'properties'` at 100% of observations (n≥20 in jsdom matrix)
2. `respects-manual-tab-switch` — after `markTabOverridden()`, next selection change leaves `rightTab` unchanged (0 overrides observed)
3. `relevant-sections-only-rendered` — for every tag in the registry matrix, rendered Section count === `getRelevantSections(tag).length` (equality, not ≤)
4. `auto-expand-matches-registry` — rendered Sections with `aria-expanded="true"` === `getAutoExpandedSections(tag)` exactly
5. `off-token-flag-present-when-value-unknown` — given `className="text-[17px]"`, font-size input renders a `data-schema-role="state-signal"` StatBadge with variant `warning`: observed ≥ 1
6. `off-token-flag-absent-when-value-matches` — given `className="text-body"`, observed badges === 0
7. `token-match-reuses-mithril` — `grep -rnE "CIEDE2000|deltaE2000" src/ --exclude="tokenMatcher.ts"` returns 0 lines (single source of truth)

---

**Ready for Phase 1.5 (flint-contract-linter) once Justin answers ODQs 1–5.**
