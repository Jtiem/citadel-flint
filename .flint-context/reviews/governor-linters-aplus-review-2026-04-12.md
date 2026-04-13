# Governor Linters — A+ Independent Code Review

**Date:** 2026-04-12
**Reviewer:** /review (Flint quality gate)
**Scope:** 7 new governor linters shipped this session
**Review type:** Deep independent audit (not per-commit gate)

---

## Summary Table

| # | File | Grade | Critical | Major | Minor | Tests | LOC |
|---|------|-------|----------|-------|-------|-------|-----|
| 1 | `mutationPlanner.ts` | **B-** | 0 | 3 | 2 | 370L | 377 |
| 2 | `hydrationLinter.ts` | **A-** | 0 | 1 | 3 | 186L | 274 |
| 3 | `AnimationLinter.ts` | **B+** | 0 | 2 | 3 | 205L | 569 |
| 4 | `fluidInterpolator.ts` | **A** | 0 | 0 | 3 | 225L | 475 |
| 5 | `compositionValidator.ts` | **B** | 1 | 2 | 1 | 388L | 291 |
| 6 | `darkModeSafety.ts` | **B** | 0 | 3 | 2 | 313L | 326 |
| 7 | `tailwindVersionResolver.ts` | **A-** | 0 | 1 | 1 | 193L | 106 |

**Overall session grade: B+ / A-**
Test discipline is strong (1,880 test LOC against 2,418 production LOC, ~78% ratio). Babel AST hygiene is generally good — no Commandment 13 violations. Primary risks concentrate in (a) Mutation Planner coverage gaps for new violation types, (b) a composition validator traversal bug, and (c) inline-style drift interactions that are not addressed by any of the new code.

---

## 1. `mutationPlanner.ts` — Grade B-

Rationale: This is the P0 foundation — it sees every violation. Two real coverage gaps and one design smell keep it from A.

**MAJOR**

- **`dark-mode-drift` falls through to "Unrecognized violation type" fallback.** `darkModeSafety.ts` produces warnings with `type: 'dark-mode-drift'` and in some cases `fixable: true` + `nearestToken` populated, but `classifyViolation()` has no branch for it. Result: every P1d violation is classified semantic with confidence 0.3 and a misleading message ("Unrecognized violation type"). The deterministic path (swap primitive color → semantic token) never runs. Fix: add a `dark-mode-drift` branch mirroring the `motion-drift` pattern — deterministic when `nearestToken && fixable`, semantic otherwise.
- **`visual-regression` also falls through.** Already registered in `types.ts` union but not in the planner. Even if no linter emits it today, this is a latent bug waiting for V.2.
- **MRS opType inputs do not match `MRS_OP_WEIGHTS` keys.** The planner calls `scoreMutationMRS({ opType: 'fixToken' | 'updateProp' | 'replaceElement' | 'swapMotionToken' | 'insertNode' | 'deleteNode' | 'wrapNode' | 'assembleLayout' })`. But `MRS_OP_WEIGHTS` (riskScoringService.ts line 644) only knows `updateClassName, fixToken, updateTextContent, updateProp, injectNode, inject, wrapNode, moveNode, move, deleteNode, assembleLayout, crossFileMove`. Specifically `'replaceElement'` and `'swapMotionToken'` are unknown and fall through to `MRS_UNKNOWN_OP_WEIGHT = 0.5`, which at the default threshold (0.5) routes every single one to `riskGated`. This directly undermines P5 motion auto-fix and P2 registry adoption. Fix: add these op types to `MRS_OP_WEIGHTS` or normalize in the planner before calling MRS.

**MINOR**

- `ALWAYS_RISK_GATED_OPS` contains `'insertNode'` but `replaceElement` is not in the set even though it's structurally equivalent (DOM element swap). This is inconsistent with the stated rule that structural element swaps always require confirmation (line 70).
- `computeDriftConfidence()` uses `violation.value` as the "delta" but for typography-drift and spacing-drift `value` is not always a numeric CIEDE2000-like delta — typography reports pt/px diffs, spacing reports px diffs, and shadow-drift reports an ordinal. Confidence buckets (2/5/10/20) are tuned for color ΔE and are nonsensical for those. Confidence should be type-aware or normalized upstream.

**PASS**

- Scale conversion `(riskThreshold ?? 50) / 100` is correct; the stateless `scoreMutation` returns 0.0–1.0 (riskScoringService.ts line 632+), matching the docstring.
- Classification branches for `a11y`, drift types, `registry`, `hydration`, `composition`, `motion-drift`, `fluid-suggestion`, `sync` are exhaustive and correctly reason about semantic vs deterministic.

---

## 2. `hydrationLinter.ts` — Grade A-

Rationale: Cleanest of the seven. Good AST discipline, explicit parent-guard on `JSXExpressionContainer`, and a clear two-strategy design.

**MAJOR**

- **False-positive risk on `value` / `defaultValue` attributes for form controls.** Line 244 includes `value` and `defaultValue` in the attributes to scan. A form like `<input value="$0.00" />` is legitimate initial state in many forms (fee calculators, price resets). The default price regex `/\$\s?\d{1,3}(,\d{3})*\.\d{2}\b/` will fire on any zero-state currency field. Recommend: split attribute lists — scan `alt|placeholder|title|aria-label|label` at severity amber, scan `value|defaultValue` only when `figmaPlaceholders.has(literal)` (figma-informed path only).

**MINOR**

- `John Smith` / `Jane Doe` patterns lack the case-insensitive flag. "john doe" lowercase will pass through. Add `/i`.
- `isDataBindingHint()` returns false for `{{ product.price }}` with leading space because the regex requires `{{.*}}` but the literal match later compares `node.characters` (rendered text, never `{{...}}`). So this function as written only matters for layer *names*. Not a bug, but worth a comment — this caught me.
- Counter-based ID `hydration-${counter}` is not stable across re-audits. If two runs produce violations in different orders (e.g. parallel visitors merged), IDs drift. Prefer `hydration-${line}-${column}`.

**PASS**

- Uses `errorRecovery: true` in parser — graceful on partial/in-progress source.
- Correctly excludes `JSXExpressionContainer` when parent is `JSXAttribute` (already handled by the attribute visitor), preventing double-reporting.
- Never regex-edits source code. Commandment 13 clean.
- Policy gate (`'off'`) short-circuits before parsing — good perf hygiene.

---

## 3. `AnimationLinter.ts` — Grade B+

Rationale: Solid preset tables and token matching. Architecture has one subtle bug around `warnings` vs `warningsSoFar` and an unused variable.

**MAJOR**

- **Dead variable / dual-buffer confusion.** `const warnings: LinterWarning[] = []` (line 297) is declared, `warningsSoFar` is pushed into during traversal (line 304), and only at the end does `warnings.push(...warningsSoFar)` reunify them (line 566). The `warnings` buffer is functionally useless — just rename `warningsSoFar` to `warnings` and drop line 297. As written, this obscures the "skip if no motion usage" guard and is an easy place for a future diff to introduce a double-push regression.
- **`EASE_PRESET` lookup ignores `ease-initial` mapping.** `EASE_PRESET['ease-initial'] = 'initial'` but the `EASE_RE` regex `/^ease-(\[([^\]]+)\]|([a-z-]+))$/` will match `ease-initial` and set `info.value = 'initial'`. Then line 413 does `EASE_PRESET[cls] ?? info.value` → `'initial'`. Tokens almost never use the literal string `initial`, so this emits a noisy advisory for a class Tailwind considers valid ("no token"). Treat `ease-initial` like the `TRANSITION_PRESETS` safe list.

**MINOR**

- `TRANSITION_ARB_RE` / `ANIMATE_ARB_RE` — only match *arbitrary* values. Classes like `transition-none` and `animate-spin` are handled via the safe-set check *before* `classifyMotionClass` runs, which is correct, but `classifyMotionClass` itself returns `null` for them so the implicit "handled above" coupling is fragile. Add a comment.
- Fallback match `m[2] ?? m[3]` relies on non-capturing groups being `undefined`; works in V8 but is brittle under test runners that pre-process. Use `m[2] !== undefined ? m[2] : m[3]`.
- `durationTokenMs()` parses `token.duration` first, then falls back to `token.token_value`. If a token has `duration: 'fast'` (a named level) and `token_value: '150ms'`, the function returns `null` from the first branch then *still* runs the second — but the short-circuit `if (ms !== null) return ms` means the fall-through works; not a bug, just worth a unit test.

**PASS**

- Duration and easing extraction helpers are exported for testing — good.
- Advisory vs amber distinction is well thought through (arbitrary values always amber, preset misses advisory).
- Skip-entirely guard (no tokens + no config + no usage) respects the "additive" design principle.

---

## 4. `fluidInterpolator.ts` — Grade A

Rationale: Best of the batch. Clean parse, correct clamp math, sensible guards. Advisory-only with `fixable: false` aligns with Commandment C16 policy.

**MINOR**

- `BREAKPOINTS` set includes `'base'`, which means a user class literally prefixed `base:` would be accepted as a "breakpoint". Tailwind has no `base:` variant — strip it from the breakpoint set and handle `'base'` implicitly via `colonIdx === -1`.
- `round(n, 4)` returns 4 decimal places for `vwCoeff`, meaning messages like `clamp(1rem, 0.5rem + 0.7813vw, 1.25rem)` can include 4 trailing digits. Designers will nit-pick. Consider 2 decimals for vw, 3 for rem.
- Arbitrary values are silently rejected in `parseClass()`. For a designer who uses `text-[18px] lg:text-[22px]`, this rule will never fire. Document the limitation in the header, or parse `[Npx]` / `[Nrem]` values.

**PASS**

- Correctly uses a per-group dedupe-by-breakpoint map (line 351) so duplicate classes don't produce duplicate suggestions.
- `MIN_DELTA_PX = 4` floor suppresses trivial noise.
- `maxVwPx <= minVwPx` degenerate guard present.
- Math is correct: verified `computeClampExpression(16, 20, 768, 1024)` → slope `(20-16)/(1024-768) = 0.015625 px/px = 1.5625 px/100px → 1.5625vw ÷ 16 = 0.0977… rem/100px`. The documented example in the header (`0.78vw`) appears to use a different viewport range; the math in the function is correct — the docstring example should be recomputed.

---

## 5. `compositionValidator.ts` — Grade B

Rationale: The traversal has a real ordering bug in depth tracking; otherwise the design is sound.

**CRITICAL**

- **`depthStack` is incremented inside the `maxDepth !== undefined` guarded block, but decremented in `exit` inside the *same* guard.** Line 164 sets `depthStack.set(componentName, currentDepth)` only when `rules?.maxDepth !== undefined` AND `mode003 !== 'off'`. Line 246–253 decrements in exit using the same guard (`rules?.maxDepth !== undefined`) but **not** the `mode003` check. If a user sets `ruleModes['MITHRIL-COMP-003'] = 'off'`, enter will not increment but exit will decrement, producing negative implicit depths on subsequent traversals within the same call. (It happens to recover because `if (currentDepth <= 1)` deletes the entry.) More importantly, the depth is tracked *per-component-name globally*, not *per-ancestor-chain*. Two sibling `<Card>` trees in the same file will incorrectly accumulate depth across siblings because `enter` runs on Card2 while Card1's subtree has already `exit`ed — that part is fine — but nested Cards in sibling branches share the same counter and this breaks for cases like:
  ```jsx
  <div><Card><Card/></Card><Card><Card/></Card></div>
  ```
  First `<Card>` → depth 1, nested → depth 2, exit → 1, exit → 0 (deleted). Second tree re-enters at 1 → fine. OK, re-reading: this actually works because of the delete-at-1 reset. **Reclassify as MAJOR**, not CRITICAL — the real bug is only the `mode003 === 'off'` asymmetry in exit. Fix: mirror the mode guard in `exit`, or track depth unconditionally and only *emit* conditionally.

**MAJOR**

- **`isPascalCase` accepts `PascalCase` AND `ALLCAPS` (e.g. `HTML`, `URL`).** Any intrinsic-ish name starting with uppercase passes. React convention is PascalCase with at least one lowercase letter; tighter check: `/^[A-Z][a-zA-Z0-9]*$/`.
- **Forbidden / allowed children loops are O(N × ancestor-depth).** For every JSX element, we walk the full parent stack. In a deeply nested file this is quadratic. Acceptable for typical depths (<20) but the registry lookup inside the loop uses `rulesMap.get(ancestor)` — cache a per-frame "active constraints" derived set when entering the parent.

**MINOR**

- Duplicate-firing risk: if `allowedChildren` is set AND `forbiddenChildren` includes a subset, a violating child fires *two* warnings (comp-001 forbidden + comp-001 not-allowed). Both use different warning IDs but the same ruleId — downstream consumers may double-count. Prefer short-circuit.

**PASS**

- Taxonomy lookups hoisted outside the traversal.
- Registry-overrides-defaults merge order is correct.
- Fragment / non-JSXIdentifier name nodes correctly ignored.

---

## 6. `darkModeSafety.ts` — Grade B

Rationale: Clever token-path → semantic-dark resolution strategy, but several edge cases bite.

**MAJOR**

- **`requiresDarkMode` + `ruleMode === 'advisory'` interaction is wrong.** Line 201–206:
  ```ts
  const baseSeverity =
      ruleMode === 'advisory'
          ? 'advisory'
          : requiresDarkMode ? 'critical' : 'advisory'
  ```
  This means when `requiresDarkMode = true` but user sets `ruleModes['MITHRIL-DARK-001'] = 'advisory'`, we respect the user — good. But when `requiresDarkMode = true` and ruleMode is undefined, severity jumps straight to `'critical'`, skipping `'amber'`. The rest of Flint grades dark-mode gaps as `amber` (see `MithrilLinter.ts`). Inconsistent with other Mithril rules. Use `amber` as the default ceiling unless a future policy flag explicitly escalates.
- **`COLOR_UTILITY_RE` greedy on `shadow-`.** Matches `shadow-md`, `shadow-lg`, `shadow-xl` as "color utilities" with colorPart `md/lg/xl`. These are size utilities, not colors. They'll be flagged as "primitive color without dark counterpart" every time. Same for `ring-1`, `ring-2`, `outline-1`, `outline-offset-2`. Fix: filter known non-color suffixes, or restrict the regex to values containing a dash+digit or recognized color keywords.
- **`findSemanticAlternatives()` skips any token that lacks `extended.modes.dark` AND `mode !== 'dark'`.** This means a project that uses the *semantic companion* strategy (two separate tokens: `color.surface` mode=light and `color.surface` mode=dark) won't surface the light-mode token as an alternative — only the dark one. Suggestion text will point at the wrong path. Flip the filter to check whether a matching companion exists.

**MINOR**

- `JSX element without `data-flint-id` is silently skipped (line 213–214). Fine for audit runs after `injectFlintIds`, but fails silently for raw user-provided files.
- Unused `eslint-disable` implicit: `token as DesignTokenWithModes` casts happen in three places without an `is` guard helper.

**PASS**

- `projectHasDarkMode()` check short-circuits the entire visitor — correct performance.
- Never regex-edits source.
- Does not produce duplicate warnings per (nodeId, prefix) pair — uses a Map keyed correctly.

---

## 7. `tailwindVersionResolver.ts` — Grade A-

Rationale: Tiny, focused, testable. One security nit, one edge case.

**MAJOR**

- **`fs.readFileSync` in a linter path with no path validation.** `resolveTailwindVersion(projectRoot)` trusts the caller's `projectRoot` and joins arbitrary paths — it's the caller's responsibility to sandbox, but at minimum the function should guard against `projectRoot === ''` (would read host-cwd `package.json`). Add `if (!projectRoot || projectRoot.length === 0) return null`.

**MINOR**

- `cleanVersion('^4.0.0-beta.1')` returns `'4.0.0-beta.1'` — then `parseMajor` returns 4, but a future check `major === 3 || major === 4` excludes preview majors like `5.0.0-alpha`. Log-or-return would be better than a silent `null`. Low priority.

**PASS**

- Commandment 14: resolver does not write, only reads.
- Three-tier fallback (detected env → package.json → null) is documented and correct.
- Pure synchronous, easy to test.

---

## Cross-File Concerns

### Rule-ID / type-union consistency

Verified against `types.ts` line 63 `LinterWarning['type']` union. All 7 types are registered:
- `hydration`, `motion-drift`, `fluid-suggestion`, `composition`, `dark-mode-drift`, `tailwind-version-drift`, `visual-regression` (unused).

All 7 rule IDs are present in `errorTaxonomy.ts`, `MithrilLinter.ts`, and `policyEngine.ts` (verified via single grep).

**GAP:** `mutationPlanner.ts` handles 6 of 7 (see Major #1 above — `dark-mode-drift` missing).

### Babel AST correctness

No Commandment 13 violations. All 6 AST-consuming linters:
- Use `@babel/traverse` exclusively.
- Guard `loc?.start` access with optional chaining.
- Check `t.isJSXIdentifier` / `t.isStringLiteral` before use.
- Do not mutate the AST (read-only visitors).

### Performance

- `compositionValidator` has the worst theoretical case (O(N × depth)) but depths are bounded.
- `AnimationLinter` and `darkModeSafety` walk the AST once each — linear.
- `fluidInterpolator` is linear with a small per-attribute cost.
- `hydrationLinter` walks 3 visitor types in a single traversal — correct.

No O(n²) surprises. No unnecessary re-parses. `tailwindVersionResolver` reads files once and caches per-call but not across calls — consider LRU if hit rate matters.

### Test coverage gaps

| Linter | Has tests | Gaps I'd write |
|---|---|---|
| mutationPlanner | 370L | **Missing: dark-mode-drift classification, replaceElement MRS normalization, visual-regression fallthrough** |
| hydrationLinter | 186L | Form-control false-positive (`<input value="$0.00" />`), lowercase name patterns |
| AnimationLinter | 205L | `ease-initial` noise, dual-buffer regression guard |
| fluidInterpolator | 225L | Arbitrary values `text-[18px] lg:text-[22px]`, `base:` false variant |
| compositionValidator | 388L | `mode003 === 'off'` asymmetric exit, sibling-Cards reset |
| darkModeSafety | 313L | `shadow-md` false positive, `ring-2` false positive, `requiresDarkMode → amber` path |
| tailwindVersionResolver | 193L | Empty-string projectRoot, `-beta`/`-alpha` prerelease |

---

## Prioritized Punch List

### Must fix before shipping (CRITICAL / MAJOR)

1. **`mutationPlanner.ts`** — Add `dark-mode-drift` classification branch mirroring `motion-drift`. [MAJOR]
2. **`mutationPlanner.ts`** — Register `replaceElement` and `swapMotionToken` in `MRS_OP_WEIGHTS` or normalize opType before MRS call. Currently routes all such fixes to `riskGated` via the unknown-op fallback. [MAJOR]
3. **`compositionValidator.ts`** — Mirror `mode003` guard in the `exit` branch to prevent depth-counter drift when user sets the rule to `'off'`. [MAJOR, originally flagged CRITICAL]
4. **`darkModeSafety.ts`** — Filter `shadow-md`, `ring-1`, `outline-offset-*` and similar size utilities out of `COLOR_UTILITY_RE` or add a color-value recognizer. Currently produces guaranteed false positives. [MAJOR]
5. **`darkModeSafety.ts`** — Revisit `requiresDarkMode → 'critical'` severity ceiling; align with other Mithril rules at `amber`. [MAJOR]
6. **`hydrationLinter.ts`** — Gate `value` / `defaultValue` attribute scanning behind the figma-informed path only. [MAJOR]
7. **`AnimationLinter.ts`** — Remove dead `warnings` buffer and collapse to `warningsSoFar`; add `ease-initial` to the safe list. [MAJOR]

### Should fix (MINOR)

8. `mutationPlanner.ts` — Type-aware `computeDriftConfidence()`.
9. `mutationPlanner.ts` — Add `replaceElement` to `ALWAYS_RISK_GATED_OPS`.
10. `compositionValidator.ts` — Tighten `isPascalCase` to require a lowercase letter.
11. `compositionValidator.ts` — Short-circuit duplicate comp-001 fires when both `forbiddenChildren` and `allowedChildren` match.
12. `hydrationLinter.ts` — Add `/i` flag to `John Smith`/`Jane Doe` patterns.
13. `hydrationLinter.ts` — Stable warning IDs keyed by line/column, not counter.
14. `fluidInterpolator.ts` — Strip `'base'` from `BREAKPOINTS` set.
15. `fluidInterpolator.ts` — Tighten decimal formatting on `vwCoeff`.
16. `tailwindVersionResolver.ts` — Guard empty-string `projectRoot`.

### Nice to have

17. `fluidInterpolator.ts` — Support arbitrary-value breakpoint classes.
18. `tailwindVersionResolver.ts` — LRU cache across calls if hit rate matters.
19. Re-compute `fluidInterpolator` docstring example math.

---

## Verdict

**Not yet A+.** Two MAJOR correctness issues (Mutation Planner dark-mode gap + MRS opType mismatch) silently break two of the new linters' remediation flows — a user fixing dark-mode violations or motion drift via `flint_fix` will see confusing "unrecognized violation type" messages or all-riskGated results. These must ship before declaring the Governor Expansion GA.

Once items #1–#7 on the punch list are addressed, this set is solid A territory. The test discipline, the Commandment-13 hygiene, and the additive-by-default design principle across all 7 files are exemplary. The failure mode here is wiring, not craft.

---

## Files Referenced

- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/mutationPlanner.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/hydrationLinter.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/AnimationLinter.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/fluidInterpolator.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/compositionValidator.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/darkModeSafety.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/tailwindVersionResolver.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/riskScoringService.ts` (MRS scale + op weights — cross-check)
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/types.ts` (LinterWarning union)
