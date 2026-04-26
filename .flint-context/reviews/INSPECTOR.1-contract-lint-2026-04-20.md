# Contract Lint Report: INSPECTOR.1 — Context-Aware Properties Panel

**Date:** 2026-04-20
**Linter:** flint-contract-linter (schema v2.1)
**Input files:**
- `.flint-context/contracts/INSPECTOR.1-contract.md`
- `.flint-context/contracts/INSPECTOR.1.contract.ts`

---

## Verdict: REVISE

| Check | Result | Issues |
|-------|--------|--------|
| Compiles | PASS | Zero TSC errors |
| Completeness | PASS | All required sections populated |
| Impact Map | PASS | MODIFY targets exist; CREATE targets absent; owners valid |
| IPC Triangles | PASS | No IPC channels declared (correct for renderer-only feature) |
| Store Coherence | FAIL | `markTabOverridden` consumer (`App.tsx`) missing from impact map — BLOCKING |
| Test Boundaries | FAIL | Two `then` fields begin with "leaves" (not in allowed verb set) — BLOCKING |
| Commandments | WARN | C5 omitted despite A11ySection creation |
| Parallelism Safety | FAIL | `flint-test-writer` in Group C owns Group A test files — BLOCKING |
| MD ↔ TS Consistency | WARN | `useAutoTabSwitch.test.ts` absent from markdown impact table; invariant count 7 vs 9 (annotated as "selected") |
| Falsifiable Invariants | PASS | All 9 invariants carry comparison operators, units, and concrete measuredBy mechanisms |
| Non-Goals | PASS | 10 explicit non-goals; all Justin-required boundaries present |
| Audience | PASS | `'designer'` — single-valued, valid enum |

---

## Issues

### BLOCKING

**[BLOCKING — Check 5] `App.tsx` missing from impact map.**

The Store Contract section (both markdown and `.contract.ts`) states that `markTabOverridden()` is called from the tab bar click handler in `App.tsx` ("a 1-line change"). `App.tsx` is not listed in `impact`. Phase 2 agents implement only what the impact map declares. Group B and C agents will implement the `markTabOverridden` action in `canvasStore.ts` but no agent will be directed to wire the call site in `App.tsx`. The action will exist in the store with zero callers, making the `userOverrodeTab` flag permanently `false` at runtime.

Fix: Add `App.tsx` to the impact map as MODIFY, owner `flint-design-engineer`, with summary describing the 1-line tab-bar wiring. Place it in Group C (depends on the store addition from Group A).

---

**[BLOCKING — Check 6] Two TestBoundary `then` fields use "leaves" (disallowed verb).**

`validateTestBoundaries()` from `shared/contract-schema.ts` requires the first word of every `then` to be in the allowed imperative verb set: `returns | throws | rejects | resolves | emits | sets | calls | renders | dispatches | updates | writes | reads | broadcasts | blocks | allows`. "leaves" is not in that set.

The two failing entries:

1. Target: `useAutoTabSwitch — userOverrodeTab blocks auto-switch`
   Current: `"leaves canvasStore.rightTab === 'tokens' (no change)"`
   Fix example: `"sets no change — canvasStore.rightTab reads as 'tokens' after five selection dispatches (no mutation occurred)"` or `"reads canvasStore.rightTab as 'tokens' after setActiveSelection('h1:8:4') (unchanged from its value before the dispatch)"`

2. Target: `PropertiesPanel — manual tab switch during selection persists`
   Current: `"leaves canvasStore.rightTab === 'tokens'"`
   Fix example: `"reads canvasStore.rightTab as 'tokens' after CANVAS_CLICK for a second layer id (rightTab was not mutated)"`

The semantic intent of both is clear: assert that rightTab was NOT modified. The approved verb for that pattern is `reads` (assert the current value) or `sets` (assert the resulting state). Either works; choose one and apply consistently.

---

**[BLOCKING — Check 8] `flint-test-writer` is assigned Group A test scaffolds but placed only in Group C.**

The impact map assigns these two files to `flint-test-writer`:
- `src/core/__tests__/elementTypePropertyMap.test.ts` (CREATE)
- `src/hooks/__tests__/useAutoTabSwitch.test.ts` (CREATE)

The contract's `parallelismGroups` places `flint-test-writer` only in Group C. Group A contains `flint-state-architect` and `flint-ast-surgeon`. This creates a dependency conflict: Group A's test files have no agent assigned to produce them during Group A execution. The TDD "red phase" (scaffold tests before implementation) cannot happen until Group C, which is after Group B already depends on Group A's outputs being complete.

Fix (two options — pick one):

Option A: Add `flint-test-writer` to Group A in `parallelismGroups`. This gives the test writer an early group where it writes `it.todo` scaffolds for the registry and hook, then fills assertions in Group C after implementation.

Option B: Reassign ownership of the two Group A test files to `flint-state-architect` (who writes the implementation and can co-author minimal scaffolds), keeping `flint-test-writer` in Group C for the heavier component matrix tests.

Option A is preferred — it matches the Contract-First v2 workflow's intent (test-writer in earliest group for TDD scaffolding).

---

### SUGGESTIONS

**[SUGGESTION — Check 7] C5 (Accessibility is a Compiler Error) not listed in commandments despite A11ySection creation.**

`A11ySection.tsx` is a CREATE that surfaces `aria-label`, `role`, and `tabIndex` editing. The commandment checklist in the markdown says "Commandments 1, 3–6, 8–11, 14–16 are not touched by this phase" — but C5 governs accessibility enforcement, and this phase introduces a new editable surface for a11y properties. The inspector does not trigger the export gate directly, so C5 does not block here; however, Phase 2 agents benefit from knowing C5 is in scope as a reminder that the fields being edited feed the a11y compliance system.

Recommended fix: Add `5` to the `commandments` array and add a row to the commandment checklist: `| 5 (Accessibility) | Yes (indirectly) | A11ySection exposes aria-label/role/tabIndex editing, which feeds the Warden audit. No new a11y rules added; existing export gate C5 compliance unchanged. |`

---

**[SUGGESTION — Check 9] `useAutoTabSwitch.test.ts` absent from markdown impact table.**

The `.contract.ts` lists `src/hooks/__tests__/useAutoTabSwitch.test.ts` (14 entries total). The markdown Impact Map has 13 rows and is missing this entry. Since `.contract.ts` is the binding source, this does not block Phase 2, but a reviewer reading only the markdown would not know this test file is being created. Recommend adding the row to keep the markdown in sync.

---

## What Phase 2 Agents Can Rely On (once REVISE issues are closed)

- Types in `.contract.ts` compile cleanly (zero TSC errors)
- IPC is correctly declared as empty — no validators required
- All MODIFY targets exist on disk; all CREATE targets are absent — no collision risk
- All 9 invariants are falsifiable with comparison operators, units, and named verification mechanisms
- The element-type registry API signature (`getRelevantSections`, `getAutoExpandedSections`, `InspectorSection`) is fully typed
- Off-token row visual contract (`OffTokenRowVisual`) is fully specified
- `CanvasStoreInspector1Additions` is typed and ready to import
- `VisualLayerShape` is declared inline — no cross-file type coupling
- All four inspector section prop types (`TypographySectionProps`, `FormPropsSectionProps`, `MediaPropsSectionProps`, `A11ySectionProps`) are ready to import
- Non-goals are explicit and exhaustive — no ambiguity about scope
- 10 non-goals cover all Justin-confirmed boundaries (no canvasStore restructure, no MCP, no new token categories, no tokenMatcher duplication, session-only override)
