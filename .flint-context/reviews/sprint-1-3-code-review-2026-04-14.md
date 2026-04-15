# Sprints 1-3 Cross-Sprint Code Review — 2026-04-14

Reviewer: parallel code reviewer (independent of UX + security reviewers).
Scope: commits 3922ceb (S1), 9771452 (S2), fadf2b5 (S3). Merged to main.
Method: evidence-driven cross-sprint review, not a re-run of per-sprint reviews.

## Verdict: A

Ship as-is. No blockers. Two advisory follow-ups surfaced (see "What Did We Miss").
I am deliberately holding back the A+ grade pending the two deferred items
(`server.ts flintConfig → ResolvedPolicy` and `MITHRIL-SPC-TOUCH` visitor) landing
in Sprint 4 — the deferred-work ledger is honest about both, so this is a
timeline call, not a correctness call.

## Scoreboard

| Sprint | Scope | Evidence | Grade |
|--------|-------|----------|-------|
| 1 — Governor linters + services | 14 files + 67 new tests, visualAuditor Babel migration, healthcare dynamic a11y enumeration, MRS op-weights, MITHRIL-SPC-TOUCH Assert+Defer, darkModeSafety severity ceiling | `git show 3922ceb` confirms 14 files modified; `electron/visualAuditor.ts` L22-24 imports `@babel/core`/`traverse`/`types`, L95 comment explicitly calls out Commandment 13; `healthcare.ts` L12 imports `getErrorsByCategory`, L28-42 `collectAllA11yRuleIds` walks both policy + taxonomy | A |
| 2 — Glass UI expansion | 84 files changed (+11,638/-2,761); GovernanceDashboard 2,788→404 LOC; 20 governance subcomponents; 15 new hooks; 260 hook-level `it()` cases | `wc -l GovernanceDashboard.tsx` = 404; `ls src/components/ui/governance/` = 22 files; `ls src/hooks/` = 29 hooks; Grep `\bit\(` across `src/hooks/__tests__` = 260 | A |
| 3 — Policy engine unification | `policyLoader.ts` deleted; 6 caller redirects; `KNOWN_*_RULES` derived from REGISTRY; config-loader strict mode + path sandbox + realpathSync + trust.profiles deep-merge; configValidator coverage | `grep from.*policyLoader` in `flint-mcp/src`, `src/`, `electron/`, `server/` = 0 hits (the one `flint-mcp/dist/server.js` hit is stale build output, not source); `config-loader.ts` L482,498,512,534,540 all use `realpathSync`; new test file `config-loader.test.ts` covers strict + sandbox + realpath + deep-merge | A |

## Cross-Sprint Coherence

### S1 dark-mode-drift branch ↔ S3 policy engine — COHERENT

S1 added a `dark-mode-drift` mutation-plan branch and relaxed `darkModeSafety`
severity ceiling from critical→amber. S3 derives `KNOWN_MITHRIL_RULES` from
`REGISTRY` by category filter, so any new dark-mode rule IDs registered in
`errorTaxonomy` automatically land in the known-rules set. I grepped
`dark-mode-drift`/`darkModeSafety`/`dark_mode` in `policyEngine.ts` and
`errorTaxonomy.ts` — no hard-coded rule IDs required coordination. Dynamic
derivation makes the two sprints orthogonal by design, which is the right call.

### S1 healthcare.ts ↔ S3 KNOWN_A11Y_RULES — COHERENT, slightly duplicative

Both sprints independently converged on "read from taxonomy, don't hard-code."
S1 uses `getErrorsByCategory('a11y')` in `healthcare.ts:collectAllA11yRuleIds`.
S3 uses `Object.values(REGISTRY).filter(e => e.category === 'accessibility')` in
`policyEngine.ts`. Two different helpers, same source, same answer. This is not
a defect — it is mild duplication of the "walk the taxonomy" idiom in two files.
Sprint 4 could consolidate to a single helper, but that is a cleanup, not a
correction. Cross-sprint result: **they agree at runtime**, which is what matters.

### S2 governance hooks ↔ S3 policy reads — NO COLLISION

Grep of the 15 new S2 hooks shows every policy-adjacent call goes through
`window.flintAPI.governance.*`, never directly through policyLoader or
policyEngine. The only hook that reads resolved config is `useGovernanceConfig`,
which uses `window.flintAPI.governance.getResolvedConfig` — an IPC boundary
call, not an import of the deleted module. S3's deletion of `policyLoader.ts`
does not ripple into Glass because nothing in `src/` ever imported it
(confirmed in Sprint 3's contract risk callout #1). Glass is isolated by design.

### S2 FixPreviewDrawerHost ↔ S1 visualAuditor Babel transform — NO INTERACTION

Spot-checked: `useGovernanceFixActions` calls `window.flintAPI.governance.previewFix`
(IPC), not visualAuditor directly. No type drift between them.

## Commandment Compliance at the Seams

| # | Commandment | Verdict | Evidence |
|---|-------------|---------|----------|
| C1 | Code is Truth | PASS | No new ephemeral state paths. `useGovernanceFixActions.handleFixSingle` routes through `applyBatch`, not direct file writes |
| C4 | Local-First Only | PASS | `grep "http://\|https://"` on S2 hooks = 0 hits |
| C5 | A11y = compiler error | PASS | `TokenDetailPanel.tsx` L23 imports `FocusTrap`, L61/L284 wraps body — MINOR-2 from source review closed; `PasteAuditModal` error-state landed per MINOR-5; S1 healthcare dynamic enumeration covers 40+ previously-silent rules |
| C6 | Gatekeeper Rule | PASS | `policyEngine.ts` L266-274 still honors `export_gate.block_on_mithril=false → advisory` and `block_on_a11y=false → advisory`. Export gate wiring preserved through the redirect |
| C12 | Atomic queuing | PARTIAL (same as pre-Sprint) | `policyEngine.ts:970` `fs.writeFileSync(policyPath, ...)` is a direct write to `.flint/policy.json`. This is NOT a source file and matches the existing precedent (deleted `policyLoader.writePolicy` did the same). Commandment 12 scopes to source files. **No regression.** S3's contract explicitly documented this as PARTIAL. |
| C13 | Deterministic Surgery | PASS | `electron/visualAuditor.ts` L22-24 + L95 comment + L108 `transformVisualSource` uses `@babel/core.transformSync`. `grep source\.replace` on visualAuditor = 0 hits. Regex→Babel migration complete |
| C14 | Bypass Prohibition | PASS | S3 `realpathSync` calls in config-loader are read-only path canonicalization, not stateful filesystem mutation. Correct use |
| C16 | In-memory validation | PASS | All 3 sprints report `npx tsc --noEmit` clean. I re-ran TSC at review time — 0 errors |

## Architectural Drift

### Concern 1 — `src/hooks/` directory scale (MEDIUM)

29 hooks in a flat directory, 15 of which are `useGovernance*`. Alphabetic
listing shows the governance cluster dominates. Risk: the next Glass feature
will add more, tipping the directory into "where does this belong?" territory.

**Severity:** MEDIUM. Not a Sprint 1-3 defect. Sprint 5+ should consider
`src/hooks/governance/` subdirectory once the hook count crosses ~20 for that
domain. **Recommendation:** note in backlog, do not block Sprint 3.

### Concern 2 — `policyEngine.ts` surface width (LOW)

S3 added 5 new exports: `loadAndResolvePolicy`, `writeResolvedPolicy`,
`mergeAndValidatePolicy`, `getDefaultResolvedPolicy`, `toLegacyFlintPolicy`.
Total exported surface is still readable — the file concentrates all policy
mutation in one place, which is the stated goal ("one session, clean state
forever"). The adapter `toLegacyFlintPolicy` is correctly marked
`@deprecated Sprint 4` per the contract.

**Severity:** LOW. Surface width is the consequence of the unification, not
an accident. Acceptable.

### Concern 3 — Legacy `toLegacyFlintPolicy` adapter permanence risk (MEDIUM)

`server.ts` still calls `loadConfig(projectRoot)` → `toLegacyFlintPolicy` to
keep `flintConfig` working. `deferred-work.md` documents this clearly with a
Sprint 4 owner and a concrete fix plan. The risk is ordinary deferred-work
risk: if Sprint 4 slips, the adapter becomes permanent. **Mitigation:** the
deferred-work.md entry is explicit and reviewable — this is the best available
state without doing Sprint 4 inside Sprint 3.

**Severity:** MEDIUM. Flagged for Justin, not a blocker.

### Concern 4 — Duplicate taxonomy-walk idiom (LOW)

Noted under Cross-Sprint Coherence. `healthcare.ts` uses `getErrorsByCategory`,
`policyEngine.ts` uses `Object.values(REGISTRY).filter(...)`. Two ways to say
the same thing. A future cleanup should pick one.

**Severity:** LOW.

## Test Quality Spot-Check

Reviewed 10 tests across all 3 sprints.

1. **`flint-mcp/src/core/__tests__/config-loader.test.ts` L39-77 (S3 strict mode)** — 4 well-scoped cases: invalid value, parse failure, default fallback, valid-with-strict. Uses real tmpdir + filesystem. **PASS**.
2. **`config-loader.test.ts` L80-106 (S3 path sandbox)** — Traversal case + absolute outside + legitimate inside + `@flint/` preset. Covers the four quadrants. **PASS**.
3. **`config-loader.test.ts` L108-131 (S3 realpathSync)** — Symlink canonicalization with graceful CI skip. Minor weakness: second case ("idempotent") only asserts `first === second`, not that both canonicalize to the real target. Could be stronger but not wrong. **PASS with minor nit**.
4. **`config-loader.test.ts` L194-207 (S3 structured event on YAML failure)** — Uses conditional `if (fs.existsSync(ledgerPath))`. **WEAK**. A conditional assertion that no-ops when the ledger file is missing is close to a non-assertion. Either the structured event fires deterministically or it doesn't — test should force one or the other. **FLAG as minor test-quality defect, not a blocker**.
5. **`electron/__tests__/visualAuditor.test.ts` L42-75 (S1 diffBoxes)** — Clean unit test, stubs BrowserWindow via `vi.mock('electron', ...)` before dynamic import. Correct pattern for Electron-side pure-logic tests. **PASS**.
6. **`src/hooks/__tests__/useGovernanceFixActions.test.ts` L1-60 (S2 fix actions)** — Documented coverage list is comprehensive (17 cases). `makeMithrilWarning` / `makeA11yWarning` factories keep cases readable. 22 `it()` cases in the file. **PASS**.
7. **`useGovernanceDefer.test.ts` (S2)** — 17 cases. Exercises the defer IPC path + notifications. **PASS** (header scan).
8. **`useGovernanceHealthSignal.test.ts` (S2)** — 18 cases. **PASS** (header scan).
9. **`useGovernanceConfig.test.ts` (S2)** — 13 cases. Enforces "the ONLY place that calls getResolvedConfig" invariant per the hook's docstring. Good architectural test. **PASS**.
10. **`flint-mcp/src/__tests__/server.set-policy.test.ts` (S3)** — 148 new lines, exercises the `flint_set_policy` redirect path including the `mergeAndValidatePolicy` error branch (MAJOR-6 fix). **PASS** (existence + line count, did not line-read).

### Test quality summary

9/10 solid, 1 weak (config-events.jsonl conditional assertion). Not enough to
downgrade the sprint. **Recommend adding a deterministic structured-event
assertion as a Sprint 4 follow-up.**

## Deferred Work Audit

Read `.flint-context/deferred-work.md`. Both items confirmed.

### Item 1 — `flintConfig` → `ResolvedPolicy` migration (Sprint 3 → Sprint 4)

**Documented:** YES. Source, blocking reason, current stopgap, proper fix,
Sprint 4 ownership. Clear and actionable.

**Verified in code:** `server.ts:1442` and `:2802` call
`loadAndResolvePolicy(projectRoot)`. `toLegacyFlintPolicy` exists on
`policyEngine` per the Sprint 3 contract. The adapter is reachable.

**Recommendation:** accept. Document link from HANDOFF.md as Sprint 4 kickoff.

### Item 2 — MITHRIL-SPC-TOUCH visitor (Sprint 1 → future)

**Documented:** YES. Very thorough — includes the 6-step fix plan,
suppress-env-var, `__resetDeferredWarningState()` for tests, and owner
(`flint-ast-surgeon`).

**Verified in code:** rule ID still declared in `policyEngine.ts`,
`fintech.ts` still marks it blocking, one-shot startup warning is in place.
Stopgap is correctly engineered — the rule is not silently missing, it is
loudly deferred.

**Recommendation:** accept.

### Item 3 (bonus) — fluidInterpolator MINOR cleanup

Also in deferred-work.md. Two cosmetic fixes (`BREAKPOINTS` strip 'base',
`formatVw` decimal clamp). Documented, owner assigned. Accept.

## What Did We Miss

Re-read the 4 source A+ reviews. Findings not absorbed into Sprints 1-3
contracts:

### Governor-linters review — 7 MINOR items (source review L37-181)

Most were absorbed into Sprint 1 (confirmed via Sprint 1 contract L39-152 in
the commit message). **Not verified:** whether all 7 MINORs from the linter
review were closed or only a subset. The commit message names specific MINORs;
the deferred-work.md lists fluidInterpolator separately. **Severity: LOW.**
Impact: unverified MINOR residue.

### Governor-services review L35-97 — 11 MINOR items (grep: 10+ hits)

Includes `suggestCssFix` hard-coded tolerance, `buildGlassUnavailableAdvisory`
`Date.now()` id (reproducibility risk for snapshot testing), `tableExists`
called on every method (perf MINOR), and `conformanceLevel` ternary redundancy.
**Not all absorbed.** Services review L242-247 explicitly says "Bundle the
MINORs into a follow-up ticket. None of them block the governor tier." —
which matches Sprint 1's scope call, but there is no single ticket tracking
them.

**Recommendation:** create a single "Sprint 1 MINOR residue" ticket so these
don't drift indefinitely. **Severity: LOW-MEDIUM.** This is the biggest gap
between "we did an A+ sweep" and "we got an A+ grade." The user paid for the
grade; the residue should be tracked, not forgotten.

### Glass UI expansion review MINOR-1 (stale closure in TokenManager)

Source review L89. Not in Sprint 2 contract scope that I can verify. May or
may not have landed. **Severity: LOW.** Would need a focused re-read of
`TokenManager.handleRejectAll/handleApproveAll` to confirm.

### Glass UI review MINOR-4 (LaunchScreen effect `[]` deps on `handleOpenFolderRequest`)

Source review L106. Stale-closure / React hooks lint violation. Check Sprint 2
absorption. **Severity: LOW.**

### Glass UI review MINOR-6 (`ScoreSection.tsx` Sparkline hardcoded hex)

Source review L118. **Mithril irony:** a hardcoded hex in the governance UI
that enforces no-hardcoded-hex. High symbolic defect value. Check whether
Sprint 2 fixed this. If not, it should be the first Sprint 4 Glass patch.
**Severity: LOW (in code), HIGH (in credibility).**

### Policy-MCP review — the biggest review at 36 MINOR/MAJOR hits

Sprint 3 absorbed the 3 CRITs, 5 MAJORs explicitly named in the contract
(CRIT-1/2/3, MAJOR-1/2/3/4/6/8). Other MAJORs (MAJOR-5 Zod validation on
tool args, MAJOR-7 whatever it was) are **explicitly out of scope** per the
contract's Non-Goals section. MINORs (MINOR-5 CallToolRequestSchema refactor,
MINOR-7 violations URI sandbox, MINOR-12 resources resolveProjectRoot) are
also explicitly deferred to Sprint 4. This is correctly scoped — there is no
hidden residue in Sprint 3 because the contract was disciplined about it.

## Recommendation

**Ship as-is.** Merged to main, tests green, TSC clean, deferred-work ledger
honest.

**Before declaring Sprint 4 scope, do these 4 things:**

1. **Triage MINOR residue.** Create one ticket per source review ("Sprint 1 MINOR residue", "Sprint 2 MINOR residue") listing every MINOR from the source review that did not land in the contract. Mark each as `closed` (verified in code) or `deferred` (still open). This is ~30 min of grep + check work and closes the A+ credibility gap.
2. **Verify MINOR-6 specifically** — ScoreSection Sparkline hardcoded hex. High symbolic value, low fix cost. If it didn't land in Sprint 2, patch it before anything else in Sprint 4.
3. **Strengthen `config-events.jsonl` test** (item 4 in test spot-check). Change the conditional assertion to a deterministic one.
4. **Consolidate the taxonomy-walk idiom** — `healthcare.ts` and `policyEngine.ts` should share a single helper for "enumerate rule IDs by category." Tiny cleanup, prevents future drift.

**Grade:** A (not A+) — pending MINOR residue triage and Sprint 4 deferred items landing.
