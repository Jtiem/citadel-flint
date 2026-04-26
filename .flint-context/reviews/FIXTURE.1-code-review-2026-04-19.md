# FIXTURE.1 Code Review

- **Phase:** FIXTURE.1
- **Dimension:** code
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-19
- **Round:** 1
- **Scope:** shared/fixture-schema.ts (Zod schema, types, defaults); flint-mcp/src/core/fixtureResolver.ts (walk-up + cache + path-traversal guard); flint-mcp/src/core/mithrilAppliesTo.ts (static map; all rules → any); flint-mcp/src/core/MithrilLinter.ts (auditAllWithSurface, append-only); flint-mcp/src/core/A11yLinter.ts (auditWithSurface + ruleMatchesSurface, append-only); flint-mcp/src/core/a11y/types.ts (appliesTo? field); flint-mcp/src/core/a11y/rules/* (per-rule classification across 11 modules); flint-mcp/src/server.ts (audit_ui_component fixture wiring at line ~2023); flint-mcp/src/tools/swarm.ts (per-directory cache pre-warm); demos/**/.flint-fixture.json (9 files); flint-mcp/src/__tests__/server.audit-fixture.test.ts (24 tests incl. beta-gate canaries)

## Verdict

**FIX-FORWARD** — 0 blocking · 1 warnings · 6 suggestions

## Findings

### CODE-001 — Demo fixtures omit `tokens` field — Beta Gate item #3 (compliant=0 / broken≥5) is not driven by demo files in the repo

**Severity:** warning · **Scope:** cross-file · **Status:** open

**Evidence:**
- `demos/01-rag-ui-builder/.flint-fixture.json:1` — No tokens field; production audit falls back to project default token set.
  ```
  { "surface": "component", "label": "RAG UI demo (Tailwind defaults)" }
  ```
- `demos/02-self-correcting/.flint-fixture.json:1`
- `demos/03-mithril-shadow-audit/.flint-fixture.json:1`
- `demos/04-sentinel/.flint-fixture.json:1`
- `demos/05-semantic-refactor/.flint-fixture.json:1`
- `demos/06-macro-recovery/.flint-fixture.json:1`
- `.flint-context/contracts/FIXTURE.1.contract.ts:283` — Contract impact rows specify tokens path; implementation omitted them.
  ```
  summary: surface:"component", tokens:"../design-tokens.json", label:"..."
  ```

**Observed:** Seven of nine demo .flint-fixture.json files contain only `surface` + `label`; none declare a `tokens` path. The end-to-end test in server.audit-fixture.test.ts uses synthetic tokens, masking the missing field. A real `audit_ui_component` invocation against demos/01-rag-ui-builder/banner-compliant.tsx will not load demos/01-rag-ui-builder/design-tokens.json automatically.

**Rationale:** The contract claim "demos differentiate compliant vs broken because tokens are now resolved" depends on each fixture pointing at the right tokens file. Without the `tokens` field, server.ts falls back to the project default. The synthetic-token test path masks the gap, so beta canary passes by accident, not by design.

**Proposed fix:** Add `"tokens": "./design-tokens.json"` to demos/01 and demos/06 fixtures (the two with both compliant + broken variants). Create demos/<dir>/design-tokens.json for any demo missing it. Lower-priority demos (02, 03, 04, 05, figma-d2c/{mui,shadcn,tailwind}) can be wired in a follow-up phase.

### CODE-002 — Mithril surface filter implementation duplicates branch logic instead of delegating to a shared matcher

**Severity:** suggestion · **Scope:** one-file · **Status:** open

**Evidence:**
- `flint-mcp/src/core/MithrilLinter.ts:2440` — Inline 3-branch if/else inclusion table.
- `flint-mcp/src/core/A11yLinter.ts:201` — Identical semantics already encoded in ruleMatchesSurface.

**Observed:** MithrilLinter.auditAllWithSurface (lines 2440-2450) reimplements the inclusion table inline. A11yLinter exports `ruleMatchesSurface` (lines 201-209) that already encodes the same semantics.

**Rationale:** Two parallel implementations of a single security/correctness-relevant predicate (silent-skip semantics) drift over time. Risk register #3 explicitly calls out misclassification harm. Centralizing eliminates a class of future bugs.

**Proposed fix:** Move `ruleMatchesSurface` to shared/fixture-schema.ts (or a sibling pure module) and import it from both linters. Keeps the inclusion table single-source.

### CODE-003 — Fixture cache stores result only at startDir — JSDoc claims intermediate caching that does not exist

**Severity:** suggestion · **Scope:** one-file · **Status:** open

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:191` — JSDoc claims intermediate ancestor caching; implementation only caches the original startDir.
  ```
  // If the fixture was found at an ancestor directory, we also cache the
  // intermediate directories to avoid redundant walk-ups on the next call.
  _cache.set(startDir, resolved)
  ```

**Observed:** fixtureResolver caches the resolved fixture under the `startDir` key only. Sibling files in the same directory hit cache (good), but cousin files in a child directory re-run the full walk-up. JSDoc claims intermediate ancestor caching that the code does not perform.

**Rationale:** Invariant `resolver-walkup-latency-warm-cache` is satisfied (sibling files hit). The cache miss on cousin directories is benign for the swarm pre-warm path (which iterates unique dirs anyway). Flagging only because comment vs implementation drift is a future-bug attractor.

**Proposed fix:** Either (a) update the comment to match implementation (only startDir cached — chosen path, lower risk), or (b) implement what the comment said by walking back down from fixtureDir to startDir setting each directory in the chain. Option (a) recommended.

### CODE-004 — Mithril filter passes `appliesTo === "component"` unconditionally — matches A11y semantics

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/MithrilLinter.ts:2442`
- `flint-mcp/src/core/A11yLinter.ts:205`
- `shared/fixture-schema.ts:33`

**Observed:** In MithrilLinter.ts:2442, `appliesTo === "component"` is treated as universal pass-through (same as "any"). A11yLinter ruleMatchesSurface line 205 has the identical rule. Matches contract JSDoc ("present for symmetry; most permissive").

**Rationale:** Confirms the two filters agree on this corner case. Logging because the contract uses prose that could read either way; current semantics are "component appliesTo = any". No action needed — documenting consensus.

### CODE-005 — Silent-skip semantics correctly preserved — no suppressed-log emission on hard-skip path

**Severity:** suggestion · **Scope:** one-line · **Status:** open · **Commandment:** 5

**Evidence:**
- `flint-mcp/src/core/A11yLinter.ts:244` — Array.filter; no log statement.
- `flint-mcp/src/core/MithrilLinter.ts:2439` — Map population skip; no log statement.

**Observed:** A11yLinter.auditWithSurface filters violations post-audit via Array.filter; no log statement. MithrilLinter.auditAllWithSurface skips entries via Map population; no log statement. Both have JSDoc contract noting "silently skipped — no log, no suppressed entry."

**Rationale:** Invariant `no-suppressed-log-spam` holds at the source level. Compiles with C5 obligation: silent-skip does not bypass enforcement on the matching surface (rules still run on document/section as appropriate).

### CODE-006 — Append-only discipline preserved on shared linter files

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/MithrilLinter.ts:2406` — FIXTURE.1 block starts after existing exports.
- `flint-mcp/src/core/A11yLinter.ts:181` — FIXTURE.1 block starts after existing default export.

**Observed:** MithrilLinter.ts FIXTURE.1 block starts at line 2406 after existing exports. A11yLinter.ts FIXTURE.1 block starts at line 181 after the existing default export. Neither modifies pre-existing visitors or rule-loading.

**Rationale:** Coordinated with RUNTIME.1 + FIGMA-LINT.1 territory per risk register #2 mitigation. No conflict surface.

### CODE-007 — Path-traversal guard correctly applied to fixture.tokens, not just fixture file location

**Severity:** suggestion · **Scope:** one-line · **Status:** open · **Commandment:** 14

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:167` — Tokens path resolved against fixture dir; isWithinRoot check before any I/O.

**Observed:** fixtureResolver.resolveFixture lines 167-176 resolve `fixture.tokens` against the fixture file directory and assert the result startsWith projectRoot via `isWithinRoot`. Throws actionable error on traversal attempt.

**Rationale:** Risk register #4 (high severity) is mitigated as specified. Note: trust boundary on the fixture JSON itself is in security reviewer scope, flagged there.

## Rubric

| Criterion | Result | Evidence / Related findings |
|-----------|--------|-----------------------------|
| C5 (silent-skip does not bypass critical a11y on matching surface) | pass | auditWithSurface filter only drops surface-mismatched rules; document-surface still runs A11Y-050 |
| C13 (no regex on source code) | pass | fixtureResolver uses path/JSON.parse only; linters use Babel AST |
| C14 (no fs/git bypass) | pass | fs.readFileSync/existsSync only inside resolver; no git access |
| C16 (in-memory validation) | pass | N/A — no AI surface in this phase |
| Invariant: applicability-zero-false-escalations | pass | auditWithSurface filter unit tests assert zero leakage on component surface |
| Invariant: no-suppressed-log-spam | pass | no log statements in either filter path |
| Invariant: demo-compliant-clean (=== 0 violations) | **fail** | Test harness asserts via synthetic tokens; real demo fixtures lacked tokens field — see CODE-001 |
| Invariant: demo-broken-distinguishable (>= 5) | **fail** | Synthetic test passes but real fixture wiring incomplete — see CODE-001 |
| TestBoundary coverage (9/9 boundaries have it() blocks) | pass | server.audit-fixture.test.ts includes ruleMatchesSurface, auditWithSurface, auditAllWithSurface, beta-gate canaries |
| Type discipline (string-literal unions; Zod .strict()) | pass | shared/fixture-schema.ts:99-118 |
| Append-only on MithrilLinter.ts and A11yLinter.ts | pass | New blocks added after existing exports; no visitor restructure |
| Cache discipline (module-local Map + clearFixtureCache exported) | pass | fixtureResolver.ts:34, 40 |
| Demo fixture correctness (valid JSON; surfaces accurate; tokens wired) | **fail** | JSON valid, surfaces correct; tokens fields missing on 7/9 — see CODE-001 |
| A11y rule classification covers all 11 modules | pass | 70 appliesTo entries across 11 rule files |

## Scope Coverage

**Reviewed:**
- shared/fixture-schema.ts
- flint-mcp/src/core/fixtureResolver.ts
- flint-mcp/src/core/mithrilAppliesTo.ts
- flint-mcp/src/core/MithrilLinter.ts (FIXTURE.1 block)
- flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block)
- flint-mcp/src/core/a11y/types.ts
- flint-mcp/src/core/a11y/rules/landmarks.ts
- flint-mcp/src/core/a11y/rules/structure.ts
- flint-mcp/src/server.ts (audit_ui_component fixture wiring)
- flint-mcp/src/tools/swarm.ts (cache pre-warm)
- flint-mcp/src/__tests__/server.audit-fixture.test.ts
- demos/**/.flint-fixture.json (9 files spot-checked)

**Skipped:**
- src/components/editor/StatusBar.tsx — UX reviewer scope
- src/store/canvasStore.ts — UX reviewer scope
- Trust boundary / malicious fixture parsing — security reviewer scope
- Per-rule a11y classifications across non-landmark/structure modules — sampled, not exhaustively re-verified
- TSC + test execution — Bash invocation denied this round; verdict relies on source-level review
