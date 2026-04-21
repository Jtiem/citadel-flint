# INSPECTOR.1 — Code Review (End-of-Round)

- **Phase:** INSPECTOR.1 — Context-Aware Properties Panel
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-20
- **Round:** 1
- **Verdict:** APPROVE WITH CHANGES
- **Scope:** 11 new/modified source files, 5 new test files, contract artifacts

## Executive summary

Implementation faithfully follows the contract. `elementTypePropertyMap` is a pure, type-safe registry. `matchValueToToken` correctly delegates color matching to `findClosestToken` and performs categorical equality for the seven non-color token families. `useAutoTabSwitch` is a minimal, correctly-dependent effect. `canvasStore` additions (`userOverrodeTab`, `markTabOverridden`, reset in `setActiveSelection(null)` and `closeWorkspace`) are idempotent and correctly placed. `App.tsx` routes manual tab clicks through `handleSetRightTab` which calls `markTabOverridden()`. PropertiesPanel is rewired around the registry. TSC is clean, and 145 inspector-scoped tests pass.

Two substantive issues block full invariant satisfaction:

1. **Missing `PropertiesPanel.inspector1.test.tsx`.** The contract lists it in `impact[]` and four invariants (`relevant-sections-only-rendered` across all 24 tags, `auto-expand-matches-registry` across all 24 tags, `auto-tab-switch-on-selection` at n≥20 trials, `respects-manual-tab-switch` across 5 selection changes) are only measurable at this integration boundary. They currently have unit coverage only.
2. **Duplicate CIEDE2000 implementation exists at `src/utils/color/colorMath.ts`** (pre-existing). Invariant `token-match-reuses-mithril` measures "1 file defining CIEDE2000 or deltaE2000 excluding tests." Grep returns 2 (`tokenMatcher.ts` and `colorMath.ts`). INSPECTOR.1 didn't introduce the drift — `colorMath.ts` predates the phase on the baseline — but the invariant as written currently fails and must be reconciled (either consolidate or relax the invariant).

## Per-invariant pass/fail

| Invariant | Threshold | Observed | Covering test | Pass/Fail |
|---|---|---|---|---|
| auto-tab-switch-on-selection | =100% over n≥20 | Hook test covers 1 null→id trial + edge cases. No n≥20 matrix. | `useAutoTabSwitch.test.ts` (7 tests) | **PARTIAL** (logic correct; matrix missing) |
| respects-manual-tab-switch | =0 overrides | Hook test asserts no switch when `userOverrodeTab=true` (1 trial) | `useAutoTabSwitch.test.ts` | **PARTIAL** (needs 5-selection-change loop) |
| relevant-sections-only-rendered | =0 diff across 24 tags | Registry-level matrix passes; DOM-level matrix absent | `elementTypePropertyMap.test.ts` (103) | **PARTIAL** (pure-function proven; rendered-Section count not asserted) |
| auto-expand-matches-registry | empty XOR across 24 tags | Registry-level asserted; `aria-expanded` DOM check absent | `elementTypePropertyMap.test.ts` | **PARTIAL** |
| off-token-flag-present-when-value-unknown | ≥1 per known-bad fixture | 1 per fixture confirmed (text-[17px], font-[Helvetica Neue]) | `TypographySection.test.tsx` | **PASS** |
| off-token-flag-absent-when-value-matches | =0 per known-good fixture | 0 confirmed for text-body | `TypographySection.test.tsx` | **PASS** |
| token-match-reuses-mithril | =1 file | 2 files (`tokenMatcher.ts`, `utils/color/colorMath.ts`) | grep check | **FAIL** |
| no-new-ipc | =0 | `shared/ipc-validators.ts` unchanged in scope | git diff | **PASS** |
| no-new-mcp-surface | =0 | `flint-mcp/` untouched | git diff | **PASS** |

Counts: **2 PASS clean, 5 PARTIAL (logic correct, matrix-depth coverage gap), 1 FAIL (pre-existing duplicate), 1 PASS (scope invariants).**

## Rubric (applicable sections)

| Criterion | Result | Evidence |
|---|---|---|
| Commandment 2 — off-token surfaced, not substituted | pass | `TypographySection.tsx:168-191` renders raw value + warning badge |
| Commandment 13 — no regex source-code surgery | pass | className parsing is runtime string parsing, not AST mutation; all AST reads via `VisualLayer` |
| Commandment 14 — no fs/electron/child_process in src/ | pass | grep on `src/components/inspector` returns no matches |
| TypeScript strict, no `any` escape hatches | pass | `TokenMatchResult` discriminated cleanly; no `as any` in inspector files |
| Store slice additions reset correctly | pass | `canvasStore.ts:755` resets in `setActiveSelection(null)`; `:1071` resets in workspace close |
| Matrix test for PropertiesPanel exists | fail | file `src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx` absent |
| `npx tsc --noEmit` = 0 errors | pass | clean exit |
| `vitest run` inspector suite | pass | 6 files, 145 tests, 0 failures |
| Single-source CIEDE2000 | fail | duplicate in `src/utils/color/colorMath.ts:114` |

## Findings

### F1 — BLOCKER: Contract-scoped matrix test is not implemented
- **File:** `src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx` (absent)
- **Observed:** File listed in `INSPECTOR.1.contract.ts:248-252` is not present on disk. `ls` confirms absence.
- **Rationale:** Four invariants (`relevant-sections-only-rendered`, `auto-expand-matches-registry`, `auto-tab-switch-on-selection` n≥20, `respects-manual-tab-switch`) are defined by the contract to be measured at the rendered-PropertiesPanel boundary (`measuredBy: 'vitest matrix renders PropertiesPanel with each tag and asserts equality'`). The pure-function registry tests prove the data structure; they do not prove that `PropertiesPanel.tsx` consumes it correctly and that `aria-expanded` matches registry output. The integration layer is the exact contract of this phase.
- **Fix:** Create the matrix test. Minimum: iterate the 24 tags, render `<PropertiesPanel layer={{tagName: T}}>`, assert rendered Section count equals `getRelevantSections(T).length` and the set of sections with `aria-expanded="true"` equals `getAutoExpandedSections(T)`. Add a 20-trial auto-switch loop and a 5-selection manual-override stick loop.

### F2 — WARNING: Duplicate CIEDE2000 implementation pre-dates phase but fails the invariant as written
- **Files:** `src/utils/tokenMatcher.ts:131` (`deltaE2000`) and `src/utils/color/colorMath.ts:114` (`deltaE2000`)
- **Observed:** `grep -rnE "CIEDE2000|deltaE2000" src/ --include='*.ts' --include='*.tsx'` excluding tests returns two definition sites.
- **Rationale:** Invariant `token-match-reuses-mithril` explicitly measures `= 1 (tokenMatcher.ts only)`. `colorMath.ts` is on the baseline before INSPECTOR.1, so the phase did not introduce the drift, but shipping without either (a) collapsing `colorMath.ts` into `tokenMatcher.ts` / re-exporting or (b) amending the invariant means Phase 3 will record a failing invariant against this phase.
- **Fix (recommended):** Make `colorMath.ts::deltaE2000` a re-export of `tokenMatcher.ts` — or vice versa — so there is one definition. If consolidation is out of scope, annotate the invariant for the integration-validator to accept `colorMath.ts` as a shared primitive used by `tokenMatcher`.

### F3 — WARNING: Hook test coverage narrower than contract invariant
- **File:** `src/hooks/__tests__/useAutoTabSwitch.test.ts`
- **Observed:** Test file covers null→id, id→id no-switch, userOverrodeTab blocks, deselect resets — correct logic, single-trial each.
- **Rationale:** Invariant `auto-tab-switch-on-selection` requires n≥20 random-starting-tab trials; `respects-manual-tab-switch` requires 5 selection changes post-override. Neither loop is present.
- **Fix:** Either add the loops here or cover them in the F1 integration matrix test.

### F4 — WARNING: TypographySection regex extraction is fragile around compound `text-*` utilities
- **File:** `src/components/inspector/TypographySection.tsx:73-135`
- **Observed:** `text-[#fff]` is disambiguated from `text-[17px]` via two runtime regex checks (size-unit vs color expression). `text-center`, `text-ellipsis`, and similar non-size/non-color `text-*` utilities fall through `extractNamed` and could be surfaced as `fontSize` if they match the permissive named pattern.
- **Rationale:** `extractNamed(cls, 'text-')` matches `[\w\-./]+` and is only used as a fontSize fallback, so `text-center` would become `fontSize: "center"`, then `matchValueToToken("center", "fontSize", ...)` flags off-token — an incorrect warning.
- **Fix:** Gate the named-fallback on a known Tailwind size-scale set (`xs|sm|base|lg|xl|2xl|…`) before treating as fontSize. Same consideration for `font-` (alignment vs weight vs family) already handled via `weightWords`; mirror the pattern.

### F5 — INFO: Acceptable departure from "expandedWhen = registry predicate"
- **File:** `src/components/inspector/TypographySection.tsx:159`
- **Observed:** `expandedWhen={() => true}` inside the component, whereas the contract says `expandedWhen = () => getAutoExpandedSections(tag).includes(section)`.
- **Rationale:** Responsibility moved up to PropertiesPanel — the panel decides whether to mount TypographySection and inside its Section wrapper it controls expansion. The invariant is still satisfiable because the outer panel gates expansion. Worth documenting so readers aren't misled by the child's hard-coded `true`.
- **Fix:** Add a code comment, or accept and document in the PropertiesPanel.

## Scope coverage

- **Reviewed:** `src/core/elementTypePropertyMap.ts`, `src/core/__tests__/elementTypePropertyMap.test.ts`, `src/utils/tokenMatcher.ts`, `src/utils/astScanner.ts` (scanners present), `src/hooks/useAutoTabSwitch.ts`, `src/hooks/__tests__/useAutoTabSwitch.test.ts`, `src/store/canvasStore.ts` (slice additions), `src/App.tsx` (tab override wiring), `src/components/ui/PropertiesPanel.tsx` (rewire), `src/components/inspector/{Typography,FormProps,MediaProps,A11y}Section.tsx` + tests.
- **Skipped:** `.flint-context/contracts/**` beyond the INSPECTOR.1 pair; no regression sweep on `DriftDetector.tsx`, `ClassBuilder.tsx`, `LayoutPanel.tsx` (declared non-goals in contract).

## Ship recommendation

Close F1 (write the matrix test) before marking INSPECTOR.1 COMPLETE. F2 (duplicate CIEDE2000) is pre-existing and is a separate cleanup; call it out to Justin so the invariant is either satisfied or formally relaxed. F3–F5 are fix-in-follow-up.
