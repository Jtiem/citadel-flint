# Mass Commit Audit (55ac38d)

**Date:** 2026-03-16
**Reviewer:** Agent 3 (Mass Commit Audit)
**Commit:** 55ac38d — "commit untracked production code"
**Files reviewed:**
- `electron/tokenMapper.ts` (524 lines)
- `src/core/governanceRulesManifest.ts` (97 lines)
- `src/store/governanceStore.ts` (91 lines)
- `src/store/notificationStore.ts` (109 lines)
- `src/store/assetStore.ts` (111 lines)
- `src/components/editor/GhostOverlay.tsx` (351 lines)
- `src/components/editor/GovernanceOverlay.tsx` (259 lines)
- `src/components/editor/ShieldOverlay.tsx` (483 lines)
- `src/components/editor/ImportAuditToast.tsx` (113 lines)
- `src/components/editor/__tests__/GovernanceOverlay.test.tsx` (spot-check)
- `src/store/__tests__/notificationStore.test.ts` (spot-check)
- `src/hooks/__tests__/useContextSync.test.ts` (spot-check)
- Cross-referenced: `src/core/MithrilLinter.ts`, `src/core/A11yLinter.ts`, `src/store/canvasStore.ts`

---

## Summary

Mixed quality. The majority of files are well-structured and adhere to the process boundary law. The math-heavy modules (`tokenMapper.ts`, `MithrilLinter.ts`) are correct and readable. However, four significant issues were found:

1. `ImportAuditToast.tsx` references two properties (`lastImportWarnings`, `clearImportWarnings`) that do not exist in `canvasStore`. This is a **runtime crash** when the component mounts — it will silently read `undefined` from the store and call `undefined()` on dismiss.
2. `electron/tokenMapper.ts` exports 10 public functions that are **never imported anywhere in the codebase**. The file was clearly written in anticipation of use by the ingestion pipeline but the call sites were never wired up. `electron/main.ts` even duplicates `roundOpacity` locally rather than importing from `tokenMapper`.
3. Twenty-nine of 49 governance rules in `governanceRulesManifest.ts` are **orphaned** — they are displayed in the GovernancePanel UI but are not enforced by any linter pass in `MithrilLinter.ts` or `A11yLinter.ts`.
4. The A11y linter's rule numbering is internally inconsistent and mismatched with the manifest (see Orphaned Rules section).

No process boundary violations, no hardcoded hex values in JSX, and no cross-store contamination were found in the files under review.

---

## Findings

### CRITICAL: ImportAuditToast reads non-existent canvasStore properties

**File:** `src/components/editor/ImportAuditToast.tsx:53-54`
**Issue:** The component calls `useCanvasStore((s) => s.lastImportWarnings)` and `useCanvasStore((s) => s.clearImportWarnings)`. Neither `lastImportWarnings` nor `clearImportWarnings` exists anywhere in `canvasStore.ts`. A comprehensive search of all store files finds zero definitions of these properties. The component will receive `undefined` for `warnings` and `undefined` for `clearImportWarnings`. On the dismiss path, `clearImportWarnings()` at line 86 will throw `TypeError: clearImportWarnings is not a function`.
**Rule violated:** Process boundary / contract integrity — component references a store API that does not exist.
**Recommended fix approach:** Either add `lastImportWarnings: ImportWarning[] | null` and `clearImportWarnings: () => void` to `canvasStore`, or migrate this component to use `importSummaryStore` (which already tracks ingestion state and is documented in `CLAUDE.md`).
**Contract required:** Yes — this is a cross-file API surface change.

---

### HIGH: tokenMapper.ts is completely unimported — all public API is dead code

**File:** `electron/tokenMapper.ts` (entire file)
**Issue:** `electron/tokenMapper.ts` exports 10 public functions: `findClosestColorToken`, `findClosestDimensionToken`, `normalizePath`, `tokenToTailwindClass`, `resolveSpacing`, `resolveFontSize`, `resolveLetterSpacing`, `resolveLineHeight`, `resolveRadius`, `roundOpacity`, and `resolveColor`, plus the constant `SYSTEMIZABLE_THRESHOLD`. A full codebase search finds zero `import ... from '...tokenMapper'` statements. Not one of these exports is consumed. Additionally, `electron/main.ts` defines its own local `roundOpacity` function (line 1271) that is functionally identical to `tokenMapper.roundOpacity`, demonstrating that the module was never wired to the callsite that needs it most.

The file comment states it "mirrors" `src/utils/tokenMatcher.ts` and `src/utils/classMapper.ts` and was written to serve the ingestion pipeline (`electron/ingestion-server.ts`, `electron/ingestion/IngestionAuditor.ts`). Those files make no reference to it.
**Rule violated:** Dead code — the file contributes 524 lines of untested, uncalled code.
**Recommended fix approach:** Either wire the ingestion pipeline to use these functions (replacing the local duplicate in `main.ts` as a first step), or delete the file and the duplicate. This is likely an unfinished integration from the Phase ING ingestion work.
**Contract required:** Yes — wiring would touch `ingestion-server.ts` and `IngestionAuditor.ts`.

---

### HIGH: Governance rule IDs in manifest do not match linter emission strings

**File:** `src/core/governanceRulesManifest.ts:31-32`
**Issue:** The manifest declares rule IDs `MITHRIL-COLOR-001` and `MITHRIL-COLOR-002`. The actual linter (`src/core/MithrilLinter.ts`) emits `MITHRIL-COL` as the rule prefix in its violation messages (e.g. the message string `"MITHRIL-COL: ΔE 4.5 – use color.primary"`). No linter anywhere emits a message with `MITHRIL-COLOR-001` or `MITHRIL-COLOR-002` as the rule ID. If any tooling attempts to correlate manifest rule IDs with linter output (e.g. for the GovernancePanel override to suppress a specific rule), the two color rules will never match any live violation.

Compare: the typography rules in the manifest (`MITHRIL-TYP-001` through `MITHRIL-TYP-005`) match the `rule` field in `MithrilLinter.ts`'s `TYP_REGEXES` array exactly. The color rules do not follow this convention.
**Rule violated:** Manifest-linter ID contract mismatch.
**Recommended fix approach:** Rename `MITHRIL-COLOR-001` to `MITHRIL-COL-001` and `MITHRIL-COLOR-002` to `MITHRIL-COL-002` in the manifest, or align the linter to emit the full `MITHRIL-COLOR-001` / `MITHRIL-COLOR-002` rule IDs in its warning messages.
**Contract required:** No — single-file fix in manifest, with a corresponding message format change in MithrilLinter if aligning the other direction.

---

### HIGH: A11y linter rule number mismatch (A11Y-007 ↔ A11Y-008 swapped in manifest vs implementation)

**File:** `src/core/A11yLinter.ts` and `src/core/governanceRulesManifest.ts`
**Issue:** The manifest declares:
- `A11Y-007` = "Table Missing Caption"
- `A11Y-008` = "HTML Missing Lang Attribute"
- `A11Y-009` = "Positive tabIndex Detected"

The linter's own comment block at the top of `A11yLinter.ts` declares:
- A11Y-007 = tabIndex > 0
- A11Y-008 = table must have accessible summary
- A11Y-009 = html must have lang

And the linter's emitted violation messages use: `A11Y-007` for tabIndex (line 335), `A11Y-008` for table (line 279), `A11Y-009` for html (line 294).

The manifest's numbering for A11Y-007, A11Y-008, A11Y-009 therefore does not match the linter's emitted rule IDs. The GovernancePanel displays rule names from the manifest; a table violation surfaced by the linter as `A11Y-008` will be displayed to the user with the name "HTML Missing Lang Attribute" rather than "Table Missing Caption."
**Rule violated:** Manifest-linter ID contract mismatch.
**Recommended fix approach:** Fix the manifest to match the linter's actual emission order: A11Y-007 = "Positive tabIndex Detected", A11Y-008 = "Table Missing Caption", A11Y-009 = "HTML Missing Lang Attribute".
**Contract required:** No — manifest-only fix.

---

### MEDIUM: ShieldOverlay uses store.getState() inside useEffect — store escape hatch misuse

**File:** `src/components/editor/ShieldOverlay.tsx:120`
**Issue:** Inside a `useEffect` that watches `totalViolations`, the component calls `useNotificationStore.getState().push(...)` directly instead of using the `pushNotification` selector that is already subscribed at line 108. This is an inconsistent pattern: the component has two paths to the notification store — the properly subscribed selector `pushNotification` and the getState() escape hatch. The `getState()` call is not wrong (it is read inside an effect, not during render), but it bypasses the subscribed function already available in scope and uses the store escape hatch unnecessarily. This is the same pattern that `CLAUDE.md` notes as belonging in components/hooks, not store actions — it is fine here, but the inconsistency could cause confusion when the `useEffect` dependencies are audited: `pushNotification` is not listed in the dependency array at line 129 even though it is the semantically equivalent function.
**Rule violated:** Minor inconsistency — not an anti-pattern per se, but creates maintenance risk.
**Recommended fix approach:** Replace `useNotificationStore.getState().push(...)` with the already-subscribed `pushNotification(...)` and add it to the `useEffect` dependency array (it is stable because Zustand selector refs are stable across renders, but being explicit is safer).
**Contract required:** No.

---

### MEDIUM: GovernanceOverlay severity badge label hardcodes string "amber" for non-critical

**File:** `src/components/editor/GovernanceOverlay.tsx:165`
**Issue:** The severity badge renders `{isCritical ? 'critical' : 'amber'}`. This is a presentation-layer hardcoding of the internal `severity` enum value. If the `LinterWarning.severity` type adds a third level (e.g. `'info'` or `'warning'`) in the future, this label will be wrong for that severity. The severity type is defined in `types/flint-api.d.ts` and already supports `'warning'` and `'info'` values that would silently display as "amber".
**Rule violated:** Fragile branching on open enum.
**Recommended fix approach:** Replace the ternary with a proper label map that covers all `LinterWarning['severity']` values.
**Contract required:** No.

---

### MEDIUM: tokenMapper.ts resolveSpacing tier-2 token match ignores the threshold

**File:** `electron/tokenMapper.ts:296`
**Issue:** In `resolveSpacing`, when a nearest dimension token is found, the function applies the token class if `tokenMatch.distance <= SNAP_TOLERANCE_PX` (1px). However, the comment at line 279 describes tier 2 as "nearest dimension token within any distance (returns token class)." The implementation is tighter than the comment, which is not a bug per se, but it means that a spacing value 2px away from a token will fall through to tier 3 (Tailwind scale snap) and potentially emit an `ImportWarning` even when a nearby token exists. The inconsistency between the comment and the implementation is a maintenance trap.
**Rule violated:** Comment/implementation drift.
**Recommended fix approach:** Either update the comment to say "within SNAP_TOLERANCE_PX" or change the threshold to match the comment's description of "any distance."
**Contract required:** No.

---

### LOW: normalizer.ts silently drops VARIABLE_ALIAS values without logging

**File:** `electron/normalizer.ts:199-201`
**Issue:** When `serializeValue` returns `null` for a `VARIABLE_ALIAS` value, the token is silently skipped (`if (token_value === null) continue`). The final log at line 218 reports how many tokens were produced but provides no count of how many alias references were skipped. A Figma file with many chained aliases will produce a token set that is smaller than expected, with no indication of why. This is a silent data-loss condition — not a crash, but it can confuse users who see fewer tokens than they defined in Figma.
**Rule violated:** Silent data loss / missing telemetry.
**Recommended fix approach:** Count skipped alias values and include them in the log message: e.g. `produced 47 tokens, skipped 12 VARIABLE_ALIAS references`.
**Contract required:** No.

---

### LOW: GhostOverlay variant-stripping regex is too aggressive

**File:** `src/components/editor/GhostOverlay.tsx:203`
**Issue:** The variant prefix is stripped with `/^[a-z-]+:/` (line 203). This matches any sequence of lowercase letters and hyphens before a colon, which would incorrectly strip the prefix from a class like `lg:hover:bg-red-500` — it would strip only `lg:` and leave `hover:bg-red-500`, which would then be matched against the prefix catalogue with the `hover:` still attached, causing a false mismatch. The `matchPrefix` function at line 95 only tries to match `entry.prefix` at the start of `base`, so `hover:bg-red-500` would not match any prefix (since no entry starts with `hover:`). The net result is that stacked variants beyond the first are silently ignored — the class appears "not hardcoded" even if it is. For single-variant classes this is correct; for multi-variant classes it produces false negatives.
**Rule violated:** Incorrect logic for multi-variant Tailwind classes.
**Recommended fix approach:** Replace the single-stripping replace with a loop or a global regex that strips all variant prefixes: `cls.replace(/^(?:[a-z-]+:)+/, '')`.
**Contract required:** No.

---

## Dead Code Inventory

The following exported symbols from `electron/tokenMapper.ts` are never imported anywhere in the codebase (excluding `node_modules`):

| Export | Line |
|--------|------|
| `SYSTEMIZABLE_THRESHOLD` | 25 |
| `findClosestColorToken` | 170 |
| `findClosestDimensionToken` | 203 |
| `normalizePath` | 245 |
| `tokenToTailwindClass` | 255 |
| `resolveSpacing` | 282 |
| `resolveFontSize` | 334 |
| `resolveLetterSpacing` | 373 |
| `resolveLineHeight` | 410 |
| `resolveRadius` | 445 |
| `roundOpacity` | 470 |
| `resolveColor` | 492 |
| `ColorMatch` (interface) | 159 |
| `DimensionMatch` (interface) | 192 |

Additionally, `electron/main.ts` defines a local `roundOpacity` function at line 1271 that is functionally identical to `tokenMapper.roundOpacity` but is a private duplicate. This is a code smell even if `tokenMapper` is eventually wired in — the duplicate should be removed when the import is established.

---

## Orphaned Governance Rules

The following 29 rule IDs are declared in `GOVERNANCE_RULES_MANIFEST` but have no corresponding enforcement in `src/core/MithrilLinter.ts` or `src/core/A11yLinter.ts`. They appear in the GovernancePanel UI as manageable rules but will never produce a violation regardless of what code is in the editor.

**Note:** The 10 A11y rules (A11Y-001 through A11Y-010) have linter enforcement, but A11Y-007/008/009 are mismatched between the manifest and the linter (see HIGH finding above).

| Rule ID | Name | Category |
|---------|------|----------|
| MITHRIL-COLOR-001 | Arbitrary Color Class | Color |
| MITHRIL-COLOR-002 | Hardcoded Inline Style Color | Color |
| BRAND-TYP-001 | Text Too Small | Brand |
| BRAND-TYP-002 | Empty Heading | Brand |
| BRAND-TYP-003 | Uppercase Body Text | Brand |
| BRAND-TYP-004 | Truncate Without Title | Brand |
| BRAND-LAY-001 | Touch Target Too Small | Layout |
| BRAND-LAY-002 | Excessive Z-Index | Layout |
| BRAND-LAY-003 | Negative Margin Usage | Layout |
| BRAND-LAY-004 | Missing Max-Width Constraint | Layout |
| BRAND-LAY-005 | Non-Standard Border Radius | Layout |
| BRAND-LAY-006 | Non-Standard Border Width | Layout |
| BRAND-CMP-001 | Image Missing Dimensions | Components |
| BRAND-CMP-002 | Button Color-Only Indication | Components |
| BRAND-CMP-003 | Inline Event Handler | Components |
| BRAND-CMP-004 | Input Missing Type | Components |
| BRAND-CMP-005 | Link Opens New Tab Without Warning | Components |
| BRAND-CMP-006 | Form Missing Name | Components |
| BRAND-CNT-001 | Lorem Ipsum Placeholder Text | Content |
| BRAND-CNT-002 | TODO/FIXME Comment in Production | Content |
| BRAND-CNT-003 | Hardcoded Email Address | Content |
| BRAND-CNT-004 | Hardcoded Phone Number | Content |
| BRAND-CNT-005 | Hardcoded Copyright Year | Content |
| BRAND-MOT-001 | Animation Without Reduced-Motion Fallback | Motion |
| BRAND-MOT-002 | Excessive Animation Duration | Motion |
| BRAND-MOT-003 | Non-Standard Transition Timing | Motion |
| QUAL-001 | Placeholder Test Selector | Quality |
| QUAL-002 | Simultaneous Loading and Error State | Quality |
| QUAL-003 | aria-disabled Without Tooltip | Quality |
| QUAL-004 | Inline Pixel Style | Quality |
| QUAL-005 | SVG Missing aria-hidden | Quality |

In total, 59% of the declared rules produce zero enforcement. This is a credibility problem for a governance product. A user enabling or disabling BRAND-CMP-003 ("Inline Event Handler — critical") has no effect because the rule is never checked.

---

## Test Quality Assessment

### `GovernanceOverlay.test.tsx` — Good

9 tests covering: empty state, row rendering per entry, Auto-Fix button visibility (both positive and negative), click handler calling `applyBatch` with the correct op/nodeId/hardcodedClass/tokenClass, severity styling for critical and amber, violation type labels, and node ID display. The mock for `applyBatch` is injected via `setState` with a spy, which is the correct Zustand testing pattern. The `extractHardcodedClass` regex path is exercised by test 5, including assertion on the extracted value. No no-op assertions found. Error states (null `nearestToken`) are covered. Quality: solid.

One note: test 5 asserts `mutations[0].hardcodedClass` is `'#ff0000'` (the raw hex value extracted from the single-quoted token in the message string). This is correct given the current `extractHardcodedClass` implementation, but it means the test is coupled to the message format. If the linter changes its message template, this test will fail at the assertion rather than the extraction, which is acceptable.

### `notificationStore.test.ts` — Excellent

13 tests organized into four suites (push, dismiss, clearAll, max-5 cap). Covers: id generation, timestamp assignment via mocked `Date.now`, newest-first ordering, history append in push order, dismiss removes from active list, history deduplication after dismiss, clearAll empties active, clearAll preserves history, eviction of oldest auto-dismissible at cap, and eviction of `shift()` when all persistent. The test comments accurately explain the eviction algorithm. `beforeEach` resets store state explicitly. No no-op assertions. Mock strategy (`vi.spyOn(Date, 'now')`) is clean and is properly restored. Quality: excellent, genuine behavior coverage.

### `useContextSync.test.ts` — Good

17 tests. Covers: the 200ms debounce boundary (199ms does not fire, 200ms fires), rapid state changes coalescing to a single call, payload fields (activeFile, selectedNodeId, mithrilCount, a11yCount, criticalCount, saveState, canvasMode), unmount cleanup, graceful no-op when `syncContext` is undefined, overrideCount from governanceStore, importSummary from importSummaryStore, and healthScore/healthGrade stub test. Uses `vi.useFakeTimers()` correctly with `act()`. The `window.flintAPI` mock is set up in a test setup file (referenced as `setup.ts`); it is not visible in this file but the test relies on it being a `vi.fn()`.

One gap: the payload shape test for `importSummary` at line 254 exercises the full tier breakdown but does not test the case where `summary.tier1Fixed` is an empty array (boundary value). The `healTimeMs` and `preHealCode` fields in `IngestionSummary` are never validated in the payload. These are minor omissions.

---

## Backlog Items

Ordered by severity:

1. **[CRITICAL] Fix `ImportAuditToast` to use a store that exists.** The component currently reads two undefined properties from `canvasStore`. Either add the properties to `canvasStore` or migrate to `importSummaryStore`. This is a silent runtime crash on dismiss. File: `src/components/editor/ImportAuditToast.tsx`.

2. **[HIGH] Reconcile `MITHRIL-COLOR-001/002` manifest IDs with linter emission strings.** The linter emits `MITHRIL-COL`; the manifest declares `MITHRIL-COLOR-001`. File: `src/core/governanceRulesManifest.ts:31-32`.

3. **[HIGH] Fix A11Y-007/008/009 ordering mismatch between manifest and linter.** Files: `src/core/governanceRulesManifest.ts:28-29` and `src/core/A11yLinter.ts`.

4. **[HIGH] Wire `electron/tokenMapper.ts` into the ingestion pipeline or delete it.** The file is 524 lines of dead code. `electron/main.ts:1271` contains a duplicate `roundOpacity` that should be resolved. Files: `electron/tokenMapper.ts`, `electron/main.ts`, `electron/ingestion-server.ts`.

5. **[HIGH] Implement linter enforcement for orphaned governance rules.** 31 of 49 manifest rules (BRAND-*, QUAL-*) have no linter backing. Flint is a governance product — governance rules that are always green regardless of code content undermine its credibility. Priority order: `BRAND-CMP-003` (Inline Event Handler, critical), `BRAND-CNT-001` (Lorem Ipsum, critical), `BRAND-CMP-005` (New tab without warning, critical).

6. **[MEDIUM] Replace `useNotificationStore.getState().push(...)` with the subscribed `pushNotification` in `ShieldOverlay`'s zero-violations effect.** File: `src/components/editor/ShieldOverlay.tsx:120`.

7. **[MEDIUM] Fix multi-variant Tailwind class stripping in `GhostOverlay.findHardcodedClasses`.** The single-strip regex produces false negatives for `lg:hover:bg-*` style classes. File: `src/components/editor/GhostOverlay.tsx:203`.

8. **[MEDIUM] Fix GovernanceOverlay severity badge label for non-binary severity values.** Replace `isCritical ? 'critical' : 'amber'` with a label map over the full severity union. File: `src/components/editor/GovernanceOverlay.tsx:165`.

9. **[LOW] Log skipped `VARIABLE_ALIAS` references in `normalizer.ts`** to prevent silent data loss going unnoticed during ingestion. File: `electron/normalizer.ts:199-201`.

10. **[LOW] Align `tokenMapper.resolveSpacing` tier-2 comment with implementation** (comment says "any distance," code says `<= 1px`). File: `electron/tokenMapper.ts:279-296`.

11. **[LOW] Add boundary-value tests to `useContextSync.test.ts`** for `importSummary` when `tier1Fixed` is an empty array, and validate that `healTimeMs`/`preHealCode` are not leaked into the context payload.
