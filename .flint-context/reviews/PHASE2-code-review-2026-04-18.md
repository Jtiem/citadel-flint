# Phase 2 Code Review — PostCSS + CSS Modules + Tailwind v4 CSS-First

- **Phase:** PHASE2-postcss-css-modules
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-18
- **Round:** 2 (re-run after earlier session hit usage limit)
- **Scope:** 4 new engine services + 4 classifier upgrade paths + MithrilLinter additive fields + tests (5530/5531 MCP passing, TSC clean, 20/20 corpus fidelity)

## Verdict

**FIX-BEFORE-SHIP** — One BLOCKING finding: the `AuditAllOptions.customPropertyMap` and `AuditAllOptions.stylesheetThemes` fields are declared on `AuditAllOptions` but **are never consumed inside `auditAll` or any downstream visitor**. The contract's integration invariant at `PHASE2-postcss-css-modules.contract.ts:589` (`var(--primary) resolves via customPropertyMap to a drift-y hex → MITHRIL-IST-COL fires`) and the signature binding at lines 1032 / 1041 / 1044 / 1052 are unimplemented. Coverage-classifier upgrade paths work in isolation (tests 46–57 all pass), but the drift-detection half of Phase 2 is a no-op. One additional WARNING on `extendedCustom` population logic. Security-critical invariants all hold. All four services are clean in isolation.

## Narrative Summary

The four new services are individually correct, self-contained, and observe every Commandment boundary this review is responsible for. The security-critical ordering holds in both hot paths: `cssStylesheetLoader.load` calls `fs.promises.stat` (line 362) before `fs.promises.readFile` (line 408), rejecting >2MB without reading a byte (boundary tests at `cssStylesheetLoader.test.ts:128-164` verify both sides of 2_000_000). `cssModulesResolver.resolve` runs the path-traversal gate (line 271) synchronously before any I/O; the test at `cssModulesResolver.test.ts:110-146` asserts both the 10ms budget AND that `fs.readFile` was never invoked for the traversal path. No mutation APIs (`path.replaceWith`, `@babel/traverse` mutation ops) appear anywhere in Phase 2 files — the only matches are doc comments pledging read-only discipline. No `child_process`, `http`, `vm`, `eval`, or `Function()`.

Coverage classifier upgrade logic is careful. The `.module.css` double-trigger risk (since `.module.css` matches both the external-stylesheet suffix list and the CSS-modules rule) is resolved by filtering module imports out of the external-stylesheet check when `allCssModulesResolved` is true (coverageClassifier.ts:643-645). Ordering — CSS-modules elevated above external-stylesheet — is documented at lines 608-611 and correct. `cssCustomPropertyMap` cycle detection is correct: the visited-set is shared through recursion for map walks but cloned (`new Set(visited)`) when falling through to fallback (line 137) so independent branches don't interfere; tests at `cssCustomPropertyMap.test.ts:150-177` confirm 2-cycle and 3-cycle both terminate with null.

The blocking finding sits at the MithrilLinter integration boundary. `AuditAllOptions` declares `customPropertyMap?: ReadonlyMap<string, string>` (line 1923) and `stylesheetThemes?: ReadonlyArray<Partial<Record<string, Record<string, string>>>>` (line 1929), but a grep of the entire MithrilLinter file shows these fields appear ONLY in the type declaration block. They are never destructured in `auditAll` (line 2059-end), never forwarded to `visitInlineStyles`, never fed into `parseCssColorToHex` (line 324), and never merged into `workingTokens` or `_knownTailwindClasses`. The contract at lines 519, 526, 589, 1032, 1041, 1044, 1052, and the behavior invariant `auditAll-signature-stability` (1146) together mandate: additive optional fields that, when supplied, (a) make `parseCssColorToHex("var(--primary)")` return the resolved hex, and (b) fold `@theme {}`-derived sections into the same merged token set Phase 1's `mergeThemeTokens` produces. Neither wiring is present. No test exercises the integration path (no `auditAll({ customPropertyMap })` or `auditAll({ stylesheetThemes })` call appears in any test file under `flint-mcp/src/core/__tests__/`).

As a result, Phase 2 makes coverage honest (the classifier upgrades) but does NOT make drift detection actually fire on the newly-parsed content. A `.tsx` file with `import './tokens.css'` and `style={{ color: 'var(--primary)' }}` will flip from `partial` to `parsed` in the coverage verdict, but Mithril will still see `null` from `parseCssColorToHex('var(--primary)')` and emit no drift warning — giving the user a false "governed" signal on a file that is unlinted at the color level. This is the exact outcome the contract non-goal list was designed to prevent.

The remaining issue — warning-class — is in `tailwindV4ThemeParser.ts:174-189`. `isInSomeSectionOfBlock` doesn't check whether THIS declaration was placed; it only reports whether ANY section is non-empty. The `extendedCustom` bucket will almost always be empty in real-world usage (any block with at least one standard token suppresses all custom-prefix collection). This does not break the contract — `extendedCustom` is documented as diagnostic-only and NOT fed into drift detection — but the diagnostic hint is effectively dead code.

The contract-specified 2MB boundary is tested on both sides. `generateScopedName` uses `djb2(modulePath + ':' + localName)` — stable across runs and environments because the input is fully deterministic. postcss-scss is loaded lazily and SCSS paths degrade cleanly to plain PostCSS when the dep is missing (the one failing test in the run is the environment artifact noted in the brief, not a code defect).

## Findings

### BLOCKER-1 — `customPropertyMap` and `stylesheetThemes` declared but not consumed in `auditAll`

**Severity:** blocking · **Scope:** cross-file · **Commandment:** 2 (No Hallucinated Styling)

**Evidence:**
- `flint-mcp/src/core/MithrilLinter.ts:1919-1929` — fields declared on `AuditAllOptions` with JSDoc asserting they ARE consumed.
- `flint-mcp/src/core/MithrilLinter.ts:2059-2250` — `auditAll` function body; `customPropertyMap` and `stylesheetThemes` are never referenced after the interface.
- `flint-mcp/src/core/MithrilLinter.ts:324-365` — `parseCssColorToHex` has no `customPropertyMap` parameter and no call site passes one. `var(--primary)` without an inline fallback still returns `null`.
- `.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts:1032` — "a file using `style={{ color: 'var(--primary)' }}` flips to parsed when customPropertyMap.resolve returns non-null for that expression" AND the Mithril integration binding at :1044 — "When customPropertyMap is supplied and contains `--primary: #0066cc`, parseCssColorToHex('var(--primary)') returns '#0066cc' instead of null."
- Grep of `flint-mcp/src/core/__tests__/` for `customPropertyMap` returns zero hits inside any `auditAll(...)` call site.

**Observed:** The two new `AuditAllOptions` fields are declared and typed, but no code path inside MithrilLinter destructures, forwards, or uses them. The JSDoc on both fields states "Mithril's `var(--x)` resolver consults this map" and "these are merged with `tailwindTheme`" — neither behavior is implemented.

**Rationale:** Coverage verdict flips to `parsed` (the classifier upgrade works), but the underlying drift detector is blind to CSS-declared tokens. A consumer who supplies `customPropertyMap` to honor the `unresolvable-var → parsed` upgrade will report the file as governed and see zero warnings on colors that ARE drifting — the exact false-confidence outcome Commandment 2 forbids. For `stylesheetThemes`, Tailwind v4 CSS-first projects get the coverage upgrade but no drift checks against their declared `@theme` tokens. This violates the signature-stability invariant's sibling intent: additive fields must be additive in BEHAVIOR too, not just in types.

**Proposed fix:**
1. In `auditAll`, after the Phase 1 `tailwindTheme` merge block (MithrilLinter.ts:2068-2074), add:
   ```ts
   // Phase 2: fold stylesheetThemes into workingTokens using the same merge pipeline
   if (options?.stylesheetThemes && options.stylesheetThemes.length > 0) {
     for (const section of options.stylesheetThemes) {
       workingTokens = mergeThemeTokens(workingTokens, {
         sections: section as ResolvedTailwindTheme['sections'],
         knownClasses: new Set(),
       })
     }
   }
   ```
2. Add an optional `customPropertyMap` parameter to `parseCssColorToHex(value, customPropertyMap?)` and, when the input is `var(--x)` without a fallback AND the map is supplied, call `customPropertyMap.get(name)` then recurse on the result.
3. Thread `options.customPropertyMap` from `auditAll` through `visitInlineStyles` (and wherever else `parseCssColorToHex` is called with a `var(...)` input — lines 363, 424, 1194-1195).
4. Add at least one test in `MithrilLinter.test.ts` that: supplies `customPropertyMap` with `--primary: #ff0000`, supplies tokens with `brand-blue: #0000ff`, runs `auditAll` on a JSX file with `style={{ color: 'var(--primary)' }}`, and asserts MITHRIL-IST-COL fires with a drift warning. Symmetric test for `stylesheetThemes` merging.

---

### WARNING-1 — `extendedCustom` population logic always skips when any standard section has entries

**Severity:** warning · **Scope:** one-file

**Evidence:** `flint-mcp/src/core/tailwindV4ThemeParser.ts:125-141, 174-189`

```ts
// Line 174-189
function isInSomeSectionOfBlock(
  varName: string,
  sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
): boolean {
  for (const sectionValues of Object.values(sections)) {
    if (sectionValues && Object.keys(sectionValues).length > 0) {
      return true
    }
  }
  return false
}
```

**Observed:** The helper ignores its `varName` parameter and returns `true` if any section has at least one entry. The enclosing loop (125-141) therefore treats every declaration as "already placed" as soon as one standard token exists, which short-circuits `extendedCustom` collection for virtually every real-world `@theme` block.

**Rationale:** `extendedCustom` is documented as diagnostic-only and not fed into drift detection, so no user-visible correctness issue. But the code claims to populate a diagnostic map and doesn't — the hint will never reach a caller. Low-risk fix-forward; trivial follow-up.

**Proposed fix:** Check whether the specific `decl.name` maps to a known section via the existing `mapThemeVarToSection(decl.name)` helper; if it returns `null`, add it to `extendedCustom`. Drop `isInSomeSectionOfBlock` entirely.

---

### WARNING-2 — Corpus runner silently skips when fixtures directory missing

**Severity:** warning · **Scope:** one-file

**Evidence:** `flint-mcp/src/core/__tests__/cssModulesResolver.test.ts:444-447`

```ts
} catch (_e) {
    console.warn('Corpus fixtures directory not found — skipping corpus runner:', FIXTURES_DIR)
    return
}
```

**Observed:** If the fixtures directory is missing or unreadable, the corpus test returns early without failing. The corpus-fidelity contract invariant (`>= 0.95`) is then unenforced in that run.

**Rationale:** In CI with a clean checkout the fixtures are present so this is safe today, but a future refactor that relocates the directory would silently disable the entire corpus check and no assertion would fail. Should be a hard error, not a warn-and-return.

**Proposed fix:** Replace `console.warn` + `return` with `throw new Error('Corpus fixtures directory required for contract invariant cssModulesResolver-fidelity >= 0.95')`.

---

## Rubric

| Criterion | Result | Evidence |
|-----------|--------|----------|
| No `path.replaceWith` / AST mutation in Phase 2 files (Commandment 13) | pass | Grep-clean across 4 new files |
| No `child_process`, `http`, `vm`, `eval`, `Function()` (Commandment 14 kin) | pass | Grep-clean |
| No `fs.writeFile` / `fs.appendFile` / `fs.unlink` in Phase 2 files | pass | Grep-clean |
| 2MB size cap enforced via `fs.stat` BEFORE `fs.readFile` | pass | cssStylesheetLoader.ts:361-380, bounded by test 4 & 5 |
| Path-traversal gate runs BEFORE any I/O with spy-asserted zero reads | pass | cssModulesResolver.test.ts:110-146, 150-174 |
| Boundary tests at 2_000_000 (accepted) and 2_000_001 (rejected) | pass | cssStylesheetLoader.test.ts:128-164 |
| Cycle detection terminates with null on `--a: var(--b); --b: var(--a)` | pass | cssCustomPropertyMap.test.ts:150-177 |
| `auditAll` signature stability (all 190+ callers unaffected) | pass | All added fields optional; TSC clean |
| Phase 0 coverage rules 1-4 + parse-failure preserved | pass | test 55 at coverageClassifier.test.ts:1031 |
| Phase 1 `tailwindConfig` and `classExpansions` upgrade paths preserved | pass | test 55b at coverageClassifier.test.ts:1043 |
| All 4 Phase 2 upgrade scenarios have positive + negative tests | pass | tests 46-57 at coverageClassifier.test.ts:790-1128 |
| `.module.css` double-trigger suppressed when CSS Modules resolved | pass | coverageClassifier.ts:642-645 |
| Corpus runner genuinely diffs against expected.json (not smoke) | pass | cssModulesResolver.test.ts:497-567 |
| `customPropertyMap` consumed by `parseCssColorToHex` when supplied | **fail** | MithrilLinter.ts: field declared at 1923 but never referenced in auditAll body or parseCssColorToHex |
| `stylesheetThemes` merged into `workingTokens` pipeline | **fail** | MithrilLinter.ts: field declared at 1929 but never referenced after declaration |
| At least one integration test exercises `auditAll({ customPropertyMap })` | **fail** | Grep zero hits across all `__tests__` dirs |
| TSC exits 0 | pass | npx tsc --noEmit ran clean |
| No hardcoded secrets; no renderer-side Node imports | pass | Changes confined to `flint-mcp/src/core/`, no renderer surface |

## Scope Coverage

**Reviewed:**
- `flint-mcp/src/core/cssStylesheetLoader.ts`
- `flint-mcp/src/core/cssCustomPropertyMap.ts`
- `flint-mcp/src/core/cssModulesResolver.ts`
- `flint-mcp/src/core/tailwindV4ThemeParser.ts`
- `flint-mcp/src/core/coverageClassifier.ts` (Phase 2 upgrade paths only)
- `flint-mcp/src/core/MithrilLinter.ts` (AuditAllOptions + auditAll body)
- `flint-mcp/src/core/__tests__/cssStylesheetLoader.test.ts`
- `flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts`
- `flint-mcp/src/core/__tests__/cssCustomPropertyMap.test.ts`
- `flint-mcp/src/core/__tests__/cssModulesResolver.test.ts`
- `flint-mcp/src/core/__tests__/tailwindV4ThemeParser.test.ts`
- `flint-mcp/src/core/__tests__/coverageClassifier.test.ts` (Phase 2 cases only)
- `.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts` (signatures + invariants cross-referenced)

**Skipped:**
- `flint-mcp/src/core/__tests__/fixtures/css-modules/**` — fidelity already at 20/20 per brief; spot-checked structure only.
- Phase 1 classifier paths — out of Phase 2 scope; regression covered by test 55b.
- Glass UI / IPC / preload surface — Phase 2 declares zero IPC or UI changes.
