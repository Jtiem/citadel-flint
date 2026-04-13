# Contract — Sprint 1: Governor Linters + Services Fixes

**Workflow phase:** Phase 1 (architect) of Contract-First v2
**Branch:** `fix/sprint-1-governor-linters-services`
**Review sources:**
- `.flint-context/reviews/governor-linters-aplus-review-2026-04-12.md`
- `.flint-context/reviews/governor-services-aplus-review-2026-04-12.md`
**Spec:** `docs/strategy/Unified_A+_Sweep_Complete_Work_Queue.md` lines 39–99
**Scope:** 13 MAJOR review-driven fixes across 12 files. No new features; correctness + safety patches only.

---

## Decisions Log (2026-04-12)

All risks raised in Phase 1 draft have been resolved by the user. These are binding for Phase 2.

- **R1 — MITHRIL-SPC-TOUCH (fintech.ts): Option C — Assert + Defer.**
  Keep `'MITHRIL-SPC-TOUCH': 'blocking'` in `fintech.ts` and keep the rule ID declared in `policyEngine.ts`. Add a one-time-per-process startup warning emitted when the rule is declared but no visitor is registered in `MithrilLinter.ts`. The warning fires from the MithrilLinter module initialization path (where policy rule IDs are reconciled against registered visitors). Log message: `"[Flint] MITHRIL-SPC-TOUCH declared in policy but no visitor registered — deferred to Mithril expansion sprint"`. Suppressible in tests via a `FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS=1` env flag OR an exported `__resetDeferredWarningState()` test helper. Rationale: preserves fintech intent, surfaces the gap loudly in production, keeps Sprint 1 scope tight. Proper fix (a `visitTouchTargets` visitor + tap-surface computation) is tracked in `.flint-context/deferred-work.md`.

- **R2 — MRS op weights: confirmed.**
  `replaceElement: 0.9`, `swapMotionToken: 0.4`. `replaceElement` is added to `ALWAYS_RISK_GATED_OPS` as belt-and-braces so it unconditionally requires confirmation regardless of computed score. Values are locked and must not drift in Phase 2.

- **R3 — darkModeSafety severity ceiling: confirmed relaxation.**
  Default ceiling moves from `'critical'` → `'amber'`. **Rationale (binding, do not second-guess):** dark-mode-drift is an advisory/visual concern, not a Commandment 5 ("Accessibility is a Compiler Error") case. Commandment 5 is about WCAG contrast failures, missing labels, keyboard traps — those live in Warden (`A11yLinter.ts`) and retain their `critical` severity unchanged. The Mithril `darkModeSafety` visitor flags missing dark-mode companion tokens, which is a design-system hygiene signal, not an a11y block. Consistency with every other Mithril advisory (all amber) wins. Export gate enforcement for real a11y contrast failures is unaffected.

- **R5 — fluidInterpolator: deferred.**
  Removed from Sprint 1 scope entirely. MINOR-only fixes (`'base'` in `BREAKPOINTS`, vw decimal formatting) are tracked in `.flint-context/deferred-work.md` for the next linter cleanup pass.

R4 (DetectorFS async migration) stands as originally documented — no decision needed, just territory check before Group A ships.

---

## Impact Map

| # | File | Type | Severity (count) | Owner Agent |
|---|------|------|------------------|-------------|
| 1 | `flint-mcp/src/core/mutationPlanner.ts` | MODIFY | 3 MAJOR (+1 MINOR) | flint-ast-surgeon |
| 2 | `flint-mcp/src/core/governance/riskScoringService.ts` | MODIFY (op-weights only) | supports #1 | coder |
| 3 | `flint-mcp/src/core/compositionValidator.ts` | MODIFY | 2 MAJOR | flint-ast-surgeon |
| 4 | `flint-mcp/src/core/darkModeSafety.ts` | MODIFY | 3 MAJOR | flint-ast-surgeon |
| 5 | `flint-mcp/src/core/hydrationLinter.ts` | MODIFY | 1 MAJOR | flint-ast-surgeon |
| 6 | `flint-mcp/src/core/AnimationLinter.ts` | MODIFY | 2 MAJOR | flint-ast-surgeon |
| 7 | `flint-mcp/src/core/tailwindVersionResolver.ts` | MODIFY | 1 MAJOR (empty root) | coder |
| 9 | `flint-mcp/src/core/governance/driftTrendService.ts` | MODIFY | 1 MAJOR | coder |
| 10 | `flint-mcp/src/core/visualRegressionStub.ts` | MODIFY | 1 MAJOR | coder |
| 11 | `flint-mcp/src/core/domains/healthcare.ts` | MODIFY | 1 MAJOR | coder |
| 12 | `flint-mcp/src/core/domains/fintech.ts` | MODIFY (pending decision) | 1 MAJOR | coder |
| 13 | `electron/visualAuditor.ts` | MODIFY | 2 MAJOR | flint-ast-surgeon |
| 14 | `shared/projectDetector.ts` | MODIFY | 2 MAJOR | coder |
| 15 | `flint-mcp/src/core/MithrilLinter.ts` | MODIFY | R1 stopgap | coder |
| T | `flint-mcp/src/core/__tests__/*` + `electron/__tests__/visualAuditor.test.ts` | ADD/MODIFY tests | — | flint-test-writer |

**Row 15 — `MithrilLinter.ts` (R1 Assert+Defer stopgap).** Add a module-scoped `Set<string>` deferred-warning registry that reconciles declared policy rule IDs against registered visitors. On the first linter invocation per process, emit a one-shot `console.warn` per unmatched rule ID with exact text: `"[Flint] MITHRIL-SPC-TOUCH declared in policy but no visitor registered — deferred to Mithril expansion sprint"`. Respect `process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS === '1'` at emit time. Export `__resetDeferredWarningState()` so tests can clear the Set between runs. Acceptance: test proves (a) first invocation logs exactly once, (b) second invocation zero additional, (c) env flag silences, (d) `__resetDeferredWarningState()` re-arms emission. Owner: `coder`. Runs in parallelism **Group A** alongside `fintech.ts`.

`government.ts` is not listed as a MODIFY because the cascade is fixed at `healthcare.ts`. Test-writer verifies gov inherits the fix.

---

## Per-File Fix Spec

### 1. `mutationPlanner.ts` — 3 MAJOR + 1 MINOR
**Defects (quoted):**
- "`dark-mode-drift` falls through to 'Unrecognized violation type' fallback."
- "`visual-regression` also falls through."
- "MRS opType inputs do not match `MRS_OP_WEIGHTS` keys. Specifically `'replaceElement'` and `'swapMotionToken'` are unknown and fall through to `MRS_UNKNOWN_OP_WEIGHT = 0.5`, which at the default threshold (0.5) routes every single one to `riskGated`."
- MINOR: "`computeDriftConfidence()` uses `violation.value` as the 'delta' but for typography-drift and spacing-drift `value` is not always a numeric CIEDE2000-like delta" — confidence should be type-aware.

**Required changes:**
1. Add `classifyViolation()` branch for `type === 'dark-mode-drift'` that mirrors the `motion-drift` pattern: `deterministic` when `nearestToken && fixable === true`, `semantic` otherwise, confidence from `computeDriftConfidence` with type-aware scale.
2. Add `classifyViolation()` branch for `type === 'visual-regression'`: always `riskGated` (structural element swap territory, no auto-fix path). Confidence 0.6 fixed.
3. Normalize opType before calling `scoreMutationMRS`. Either (a) extend `MRS_OP_WEIGHTS` in `riskScoringService.ts` to include `replaceElement`, `swapMotionToken`, `fixToken`, `insertNode`, or (b) map these in the planner prior to MRS call. **Preferred: extend `MRS_OP_WEIGHTS`** — keeps MRS authoritative.
4. Add `'replaceElement'` to `ALWAYS_RISK_GATED_OPS`.
5. Refactor `computeDriftConfidence(violation)` to branch on `violation.type`:
   - `color-drift`: existing ΔE buckets (2/5/10/20).
   - `typography-drift` / `spacing-drift`: px-distance buckets (normalize against existing advisory thresholds; test-writer confirms bucket edges with flint-ast-surgeon).
   - `shadow-drift` / `opacity-drift`: ordinal, use flat 0.6.
   - `dark-mode-drift`: 0.85 when `nearestToken` present, 0.5 otherwise.

**Acceptance criteria (tests that prove each fix):**
- `mutationPlanner.test.ts`:
  - `classifyViolation` returns `{ category: 'deterministic', confidence >= 0.8 }` for a `dark-mode-drift` warning with `nearestToken: 'color.surface'` and `fixable: true`.
  - Returns `{ category: 'riskGated' }` for a `visual-regression` warning.
  - A fix op with `opType: 'replaceElement'` and a P0 file profile scores >= 0.7 (not default 0.5) and is routed `riskGated` because of `ALWAYS_RISK_GATED_OPS`.
  - A fix op with `opType: 'swapMotionToken'` on a low-risk file scores below the configured threshold (proves the op-weight is wired through, not the unknown-op fallback).
  - `computeDriftConfidence` returns distinct values for `typography-drift` at `value: 2` vs `value: 20`.

**Dependency:** **Change #3 requires `riskScoringService.ts` file #2 to ship first** (or in the same agent call). These two files form a sequential pair.

---

### 2. `riskScoringService.ts` — supports mutationPlanner #3
**Defect (cross-referenced):** `MRS_OP_WEIGHTS` missing `replaceElement`, `swapMotionToken`.
**Required changes:** Extend `MRS_OP_WEIGHTS` dict at line 644 to include:
```
replaceElement:   0.9  // structural swap; high risk
swapMotionToken:  0.4  // deterministic token substitution; low-medium
```
Do not touch `MRS_UNKNOWN_OP_WEIGHT`, `scoreMutation`, or threshold logic. Zero behavioral change to existing keys.

**Acceptance criteria:** Existing `riskScoringService.test.ts` must all pass. Add two cases proving new weights flow through `scoreMutation` on representative file profiles.

---

### 3. `compositionValidator.ts` — 2 MAJOR
**Defects (quoted):**
- "`mode003` exit branch lacks the mode guard — if a user sets `ruleModes['MITHRIL-COMP-003'] = 'off'`, enter will not increment but exit will decrement."
- "`isPascalCase` accepts `PascalCase` AND `ALLCAPS` (e.g. `HTML`, `URL`)."

**Required changes:**
1. Mirror the `mode003 !== 'off'` guard in the `exit` branch around the `depthStack.set/delete` logic. Simpler alternative: track depth unconditionally, emit violations conditionally.
2. Tighten `isPascalCase` regex to `/^[A-Z][a-z][A-Za-z0-9]*$|^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/` — or simpler: `/^[A-Z]/.test(name) && /[a-z]/.test(name)`.
3. MINOR (optional) — short-circuit when both `forbiddenChildren` and `allowedChildren` match the same child (duplicate comp-001 fire).

**Acceptance criteria:**
- Test: set `MITHRIL-COMP-003: 'off'`, feed a deeply-nested `<Card>` tree, verify depthStack remains empty and no warnings fire.
- Test: feed `<HTML/>` as a component-like name, verify it does NOT match `isPascalCase`.
- Regression test with sibling `<Card>` trees already exists; confirm still green.

---

### 4. `darkModeSafety.ts` — 3 MAJOR
**Defects (quoted):**
- "`COLOR_UTILITY_RE` greedy on `shadow-`. Matches `shadow-md`, `shadow-lg`, `shadow-xl`... Same for `ring-1`, `ring-2`, `outline-1`, `outline-offset-2`."
- "`requiresDarkMode = true`... severity jumps straight to `'critical'`, skipping `'amber'`. The rest of Flint grades dark-mode gaps as `amber`."
- "`findSemanticAlternatives()` skips any token that lacks `extended.modes.dark` AND `mode !== 'dark'` — a project using the semantic companion strategy won't surface the light-mode token."

**Severity rationale (R3 decision 2026-04-12 — binding, do not revisit):**
The relaxation from `'critical'` → `'amber'` is NOT a weakening of a11y enforcement. `darkModeSafety` is a Mithril visitor that flags missing dark-mode companion tokens — a design-system hygiene signal, not a WCAG violation. Commandment 5 ("Accessibility is a Compiler Error") applies to Warden rules in `A11yLinter.ts` (contrast, labels, keyboard, ARIA) — those keep their `'critical'` severity unchanged and continue to block export. Dark-mode drift is advisory/visual. Every other Mithril rule grades at `'amber'`; this change restores consistency. Reviewers: do not escalate this back to critical without a WCAG citation.

**Required changes:**
1. Add `NON_COLOR_UTILITY_SUFFIXES = new Set(['md','lg','xl','2xl','1','2','4','8','offset-1','offset-2','offset-4'])` and filter before classifying as a color utility. Alternative: require a recognized color keyword or `#` in the value slot.
2. Change default ceiling from `'critical'` to `'amber'`. Only escalate to `'critical'` when an explicit policy flag (future) sets it. Verify no existing callsite depends on `'critical'`.
3. Flip the filter in `findSemanticAlternatives()` so a companion token with `mode: 'light'` surfaces when there's a matching `mode: 'dark'` variant elsewhere.

**Acceptance criteria:**
- Test: `<div className="shadow-md" />` produces zero dark-mode warnings.
- Test: `<div className="ring-2 outline-offset-2" />` produces zero dark-mode warnings.
- Test: file with an explicit primitive color class and no dark variant produces severity `'amber'` not `'critical'`.
- Test: semantic-companion token set → `findSemanticAlternatives` returns the light-mode companion in suggestion text.

---

### 5. `hydrationLinter.ts` — 1 MAJOR + 2 MINOR
**Defects (quoted):**
- "False-positive risk on `value` / `defaultValue` attributes... A form like `<input value="$0.00" />` is legitimate initial state."
- MINOR: `/John Smith/` lacks `/i` flag.
- MINOR: Counter-based IDs `hydration-${counter}` not stable.

**Required changes:**
1. Split attribute scan into two lists. `AMBER_SCAN_ATTRS = ['alt','placeholder','title','aria-label','label']` scanned always. `FIGMA_GATED_ATTRS = ['value','defaultValue']` scanned only when `figmaPlaceholders.has(literal)`.
2. Add `i` flag to the name-pattern regexes.
3. Stable IDs via `hydration-${line}-${column}`.

**Acceptance criteria:**
- Test: `<input value="$0.00" />` with no figma context → zero warnings.
- Test: `<input value="Lorem ipsum" />` with `figmaPlaceholders: new Set(['Lorem ipsum'])` → one warning.
- Test: `john smith` lowercase literal → one warning (case insensitivity).
- Test: IDs stable across two sequential audits of the same file.

---

### 6. `AnimationLinter.ts` — 2 MAJOR
**Defects (quoted):**
- "`const warnings: LinterWarning[] = []`... is functionally useless — just rename `warningsSoFar` to `warnings`."
- "`ease-initial`... emits a noisy advisory for a class Tailwind considers valid."

**Required changes:**
1. Delete the `warnings` buffer. Rename `warningsSoFar` → `warnings`. Remove the reunification `warnings.push(...warningsSoFar)` line.
2. Add `'ease-initial'` to the ease-preset safe list (same pattern as `TRANSITION_PRESETS`).

**Acceptance criteria:**
- Test: a file using `ease-initial` produces zero motion advisories.
- Existing 205L of tests must all pass after rename.
- Add regression test preventing a double-push of warnings (the dead-buffer bug returning).

---

### 7. `tailwindVersionResolver.ts` — 1 MAJOR
**Defect (quoted):** "`resolveTailwindVersion(projectRoot)` trusts the caller's `projectRoot`... at minimum the function should guard against `projectRoot === ''`."
**Required changes:** Add `if (!projectRoot || projectRoot.length === 0) return null;` at the top.
**Acceptance criteria:** Test with `''` → returns `null`. Test with `undefined` cast → returns `null`.

---

### 8. `fluidInterpolator.ts` — DEFERRED (R5 decision 2026-04-12)
Removed from Sprint 1. MINOR-only fixes tracked in `.flint-context/deferred-work.md`. Do not touch this file in Sprint 1.

---

### 9. `driftTrendService.ts` — 1 MAJOR
**Defect (quoted):** "adoption score math... `rogue` counts `governance_events` rows... while `registered` counts `DISTINCT file_path`... different units divided against each other."
**Required changes:** Count both in the same unit — switch `rogue` to `COUNT(DISTINCT file_path)` filtered by `rule_id LIKE 'MITHRIL-REG%'` from `governance_events`, matching `registered`'s distinct-file cardinality. Keep the same public shape.
**Acceptance criteria:**
- Test: seeded DB with 3 rogue events across 2 files + 5 registered mutations across 3 files → adoption score denominator = 5 distinct files, not 8.
- Zero-state test: empty ledger → `percentage: 0`, not NaN.

---

### 10. `visualRegressionStub.ts` — 1 MAJOR
**Defect (quoted):** "`runVisualRegressionAudit` returns `ok: true, violations: []`. This means a CI run... will pass with zero coverage and no indication."
**Required changes:** When `isGlassAvailable() === false`, return `{ ok: false, degraded: true, violations: [], error: 'Glass bridge unavailable' }`. Update `runVisualRegressionForLinter` to continue emitting its advisory warning (no regression there). Update consumers in `flint-ci/` / `flint-mcp/src/tools/` to treat `degraded: true` as a non-failing skip (CI exit code unchanged) but surface in output.
**Acceptance criteria:**
- Test: unregistered bridge → `ok: false, degraded: true`.
- Test: registered bridge → unchanged behavior.
- Test: `runVisualRegressionForLinter` still emits one advisory warning when degraded.

---

### 11. `healthcare.ts` — 1 MAJOR
**Defect (quoted):** "only `A11Y-001` through `A11Y-010` are escalated. The active Warden module contains 50 WCAG 2.1 AA rules. Any rule numbered A11Y-011+ silently remains at its prior mode — a silent downgrade bug."
**Required changes:** Replace hard-coded `['A11Y-001' .. 'A11Y-010']` loop with dynamic enumeration of `Object.keys(next.a11y.rules)` filtered by prefix `A11Y-`. Any missing rule keys (fallback) inherit from an imported rule registry.
**Acceptance criteria:**
- Test: seed policy with 20 a11y rules (A11Y-001..020), call `applyHealthcareEscalation`, verify ALL 20 are `'blocking'`.
- Test: zero a11y rules → escalation produces `'blocking'` mode but empty rules map (no crash).
- Test: government escalation (which delegates to healthcare) inherits the fix — all 20 rules also blocking.

---

### 12. `fintech.ts` — 1 MAJOR (R1 decision 2026-04-12: **Option C — Assert + Defer**)
**Defect (quoted):** "`MITHRIL-SPC-TOUCH` rule ID... Verify the rule exists before merging or add a startup assertion."
**Status:** `MITHRIL-SPC-TOUCH` is declared in `fintech.ts` and `policyEngine.ts` but has no corresponding visitor in `MithrilLinter.ts`. `minTouchTargetPx` is not consumed anywhere in the linter. Fintech touch-target escalation is a no-op today.

**Required changes:**
1. **Keep** `'MITHRIL-SPC-TOUCH': 'blocking'` in `fintech.ts` unchanged.
2. **Keep** the rule ID declaration in `policyEngine.ts` unchanged.
3. **Add a startup warning** from `MithrilLinter.ts` module initialization (the path where policy rule IDs are reconciled against registered visitors). When the reconciler encounters `MITHRIL-SPC-TOUCH` with no registered visitor, emit exactly once per process:
   ```
   [Flint] MITHRIL-SPC-TOUCH declared in policy but no visitor registered — deferred to Mithril expansion sprint
   ```
   Use a module-scoped `Set<string>` guard so repeated linter invocations do not re-log.
4. **Test suppression:** the warning must be suppressible in test runs. Two mechanisms (implement both — belt + suspenders):
   - Respect `process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS === '1'` at emit time.
   - Export a `__resetDeferredWarningState()` test helper from the MithrilLinter module so tests can reset the once-per-process guard between runs.
5. **Document** the deferral in `.flint-context/deferred-work.md` (see that file for the canonical spec of what a proper implementation looks like).

**Acceptance criteria:**
- Test: loading `fintech` preset invokes `applyFintechEscalation` without throwing; `'MITHRIL-SPC-TOUCH': 'blocking'` is preserved in the resulting policy.
- Test: first linter invocation after process start with `MITHRIL-SPC-TOUCH` in policy emits exactly one console warning matching the message above.
- Test: second linter invocation in the same process emits zero additional warnings (once-per-process guard).
- Test: with `FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS=1` the warning is silent.
- Test: after `__resetDeferredWarningState()` the next invocation re-emits the warning (proves the reset helper works).
- **Non-goal:** do NOT add a `visitTouchTargets` visitor. That is deferred work.

**Agent:** `coder` (fintech.ts is untouched — the real work is a tiny warning helper inside MithrilLinter.ts, which `flint-ast-surgeon` or `coder` can handle; assign to `coder` since it's not AST traversal).

---

### 13. `electron/visualAuditor.ts` — 2 MAJOR (+ several MINOR deferrable)
**Defects (quoted):**
- "Lines 109, 112–128... Regex-based module stripping violates C13 (Deterministic Surgery)."
- "Render timeout race — `loadURL` continues in the background... late resolve can call `resolve()` after the promise was already settled."

**Required changes:**
1. Replace the three `js.replace(...)` calls with a Babel plugin pass:
   - Remove `ImportDeclaration` nodes.
   - Rewrite `ExportDefaultDeclaration` (function, class, identifier, arrow-fn, `memo(X)`, `export { X as default }`) to `window.__FlintVisualComponent = <identifier>`.
   - Use `@babel/traverse` (already imported).
2. Add `let settled = false` guard. `did-finish-load`, `did-fail-load`, and timeout all check/set `settled` before calling `resolve`/`reject`. Consider `AbortController`.
3. MINOR (include if low-cost): `suggestCssFix` uses caller-provided `tolerance` instead of hard-coded `2`; `setWindowOpenHandler(() => ({ action: 'deny' }))` on window; `executeJavaScript` U+2028/U+2029 hardening.

**Acceptance criteria:**
- Test: arrow-fn default export (`export default () => <div/>`) produces a valid harness that mounts the component.
- Test: multi-line import (`import {\n  a,\n  b\n} from 'x'`) stripped cleanly, no dangling lines.
- Test: `export default memo(Foo)` handled.
- Test: settled guard — simulate `did-fail-load` AFTER timeout fires, verify `reject` is called exactly once.
- Test: existing pure-helper tests (`transformVisualSource`, `buildVisualHarnessHtml`, `diffBoxes`, `suggestCssFix`) all green after Babel refactor.

**Dependency:** Standalone. Can run fully parallel.

---

### 14. `shared/projectDetector.ts` — 2 MAJOR
**Defects (quoted):**
- "`defaultCountFiles`... symlink to its own parent... will infinite-loop the walker."
- "Make `exists` async — or at minimum avoid calling it inside hot loops."

**Required changes:**
1. Symlink cycle protection — track visited real paths via `fs.realpath` in `defaultCountFiles`, OR cap recursion depth at 12 levels, OR skip entries where `entry.isSymbolicLink()`. Preferred: realpath set + depth cap (belt + suspenders).
2. Change `DetectorFS.exists` signature from `(p: string) => boolean` to `(p: string) => Promise<boolean>`. Update `defaultFs` implementation to use `fs.promises.access` or `fs.promises.stat`. Update all call sites to `await`.

**Type contract change:** Breaking API for `DetectorFS`. This is a Sprint 1 acceptable break because no external consumers exist yet (shared internal).

**Acceptance criteria:**
- Test: inject a fake FS with a symlink cycle → walker terminates within depth cap.
- Test: `DetectorFS.exists` returns `Promise<boolean>`, existing detectors still work.
- Existing `projectDetector.test.ts` all pass after signature migration.

---

## Work-Partition Table (Agent Assignment)

| File | Primary Agent | Rationale |
|------|---------------|-----------|
| mutationPlanner.ts | flint-ast-surgeon | Classification + AST-aware confidence |
| riskScoringService.ts | coder | Plain dict extension, no AST |
| compositionValidator.ts | flint-ast-surgeon | Traversal guard fix |
| darkModeSafety.ts | flint-ast-surgeon | Regex + token-graph logic |
| hydrationLinter.ts | flint-ast-surgeon | Attribute visitor split |
| AnimationLinter.ts | flint-ast-surgeon | Buffer refactor + safe-list |
| tailwindVersionResolver.ts | coder | 1-line guard |
| driftTrendService.ts | coder | SQL aggregation fix |
| visualRegressionStub.ts | coder | Return-shape change |
| healthcare.ts | coder | Dynamic enumeration |
| fintech.ts (+ MithrilLinter.ts warning helper) | coder | Assert+Defer per R1 decision — startup warning only, no visitor |
| visualAuditor.ts | flint-ast-surgeon | Babel plugin replacing regex |
| projectDetector.ts | coder | FS + async signature |
| All __tests__ | flint-test-writer | Writes all acceptance-criteria tests; runs after or alongside each agent |

---

## Parallelization Groups

**4 parallel groups total.** Groups run sequentially; files inside each group run concurrently.

### Group A (parallel) — independent file fixes
- `compositionValidator.ts`
- `darkModeSafety.ts`
- `hydrationLinter.ts`
- `AnimationLinter.ts`
- `tailwindVersionResolver.ts`
- `visualAuditor.ts` (Electron — fully standalone)
- `projectDetector.ts`
- `driftTrendService.ts`
- `visualRegressionStub.ts`
- `healthcare.ts` (cascade fix — government inherits automatically)
- `fintech.ts` + `MithrilLinter.ts` deferred-rule warning helper (R1 Assert+Defer) — see row 15

### Group B (sequential AFTER Group A completes) — pair
- `riskScoringService.ts` (extend `MRS_OP_WEIGHTS`)
- then `mutationPlanner.ts` (depends on #2 shipping first — the `replaceElement` / `swapMotionToken` weights must exist before planner normalizes opTypes)

These two can technically ship in one agent call (both to flint-ast-surgeon) as a single atomic change — and that is **recommended**. If split, #2 MUST merge first.

### Group C — (dissolved)
R1 resolved 2026-04-12. `fintech.ts` + MithrilLinter warning helper moved into Group A.

### Group D (test-writer, parallel with everything) — all `__tests__`
flint-test-writer writes acceptance-criteria tests per file as each agent finishes. Tests live in:
- `flint-mcp/src/core/__tests__/*.test.ts`
- `flint-mcp/src/core/governance/__tests__/*.test.ts`
- `flint-mcp/src/core/domains/__tests__/*.test.ts`
- `electron/__tests__/visualAuditor.test.ts`
- `shared/__tests__/projectDetector.test.ts`

---

## Commandment Checklist

| # | Commandment | Applies | Satisfied by |
|---|-------------|---------|--------------|
| 13 | Deterministic Surgery (no regex) | YES | visualAuditor.ts Babel refactor removes the only existing regex-on-source violation in Sprint 1 scope |
| 15 | Granular AST Tools Only | YES | Same — visualAuditor replaces raw-string mutation |
| 14 | Bypass Prohibition | YES | projectDetector uses `fs.promises`, remains `shared/` utility consumed by electron+server (NOT src/) |
| 5 | Accessibility is a Compiler Error | YES | healthcare.ts fix closes silent-downgrade hole for A11Y-011..050 |
| 9 | CIEDE2000 ΔE | YES | mutationPlanner confidence refactor preserves ΔE semantics for color-drift, adds scale-appropriate buckets for non-color drift types |
| 4 | Local-First | YES | visualAuditor CSP/sandbox posture preserved; no new network surface |

No commandment violations introduced. One (C13/C15) violation resolved.

---

## Implementation Order

1. **Spawn Group A in parallel** (10+ agents, one per file).
2. **Spawn Group B as a sequential pair** (riskScoringService → mutationPlanner) OR as one combined agent call.
3. **flint-test-writer runs alongside**, writing tests per file as each land. Tests target acceptance criteria above.
4. **Gate:** `npx tsc --noEmit` → 0 errors.
5. **Gate:** `cd flint-mcp && npm test` → report pass count, zero regressions.
6. **Gate:** `npm run test:react` → zero regressions (no UI changes in Sprint 1, should be no-op).
7. **Gate:** `/review` before commit.
8. **flint-integration-validator** Phase 3.

---

## Risks

All Phase 1 risks have been resolved by user decisions on 2026-04-12 (see Decisions Log at the top of this document). Remaining open risks are operational only.

### R4 — `DetectorFS.exists` async migration breaks shared interface
No external consumers today, but any in-flight work on a `DetectorFS` variant should be rebased. Check `.flint-context/ACTIVE-SWARM-TERRITORY.md` before Group A ships.

### Resolved risks (historical record)
- **R1 (MITHRIL-SPC-TOUCH):** Resolved — Option C Assert+Defer. See Decisions Log and file #12.
- **R2 (MRS op weights):** Resolved — `replaceElement: 0.9`, `swapMotionToken: 0.4`, `replaceElement` added to `ALWAYS_RISK_GATED_OPS`.
- **R3 (darkModeSafety severity):** Resolved — ceiling relaxes `critical` → `amber`. See severity rationale block in file #4. Commandment 5 is NOT threatened because Warden rules retain their critical severity unchanged.
- **R5 (fluidInterpolator):** Resolved — deferred out of Sprint 1 entirely. Tracked in `.flint-context/deferred-work.md`.

---

## Out of Scope (explicit non-goals)

- No new linter rules (MITHRIL-SPC-TOUCH stays unshipped pending R1).
- No new MCP tools.
- No store/IPC changes.
- No Glass UI changes.
- MINORs from the reviews are bundled into a follow-up ticket unless trivially included in a MAJOR fix.
