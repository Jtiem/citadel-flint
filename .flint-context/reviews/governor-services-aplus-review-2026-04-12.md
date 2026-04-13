# Governor Services A+ Code Review — 2026-04-12

Reviewer: /review gate (Flint quality gate)
Scope: 7 files shipped this session (P3, P3.5, P7, FORGE.2)
Grading: A+ (flawless) / A (ship) / B (ship with minor) / C (fix-before-ship) / D (major rework) / F (reject)

---

## File-by-file grades

| # | File | Grade | Blockers | Majors | Minors |
|---|---|---|---|---|---|
| 1 | `flint-mcp/src/core/governance/driftTrendService.ts` | **A-** | 0 | 1 | 3 |
| 2 | `electron/visualAuditor.ts` | **B+** | 0 | 3 | 4 |
| 3 | `flint-mcp/src/core/visualRegressionStub.ts` | **A** | 0 | 1 | 2 |
| 4 | `flint-mcp/src/core/domains/healthcare.ts` | **B** | 0 | 2 | 2 |
| 5 | `flint-mcp/src/core/domains/fintech.ts` | **B+** | 0 | 1 | 2 |
| 6 | `flint-mcp/src/core/domains/government.ts` | **A-** | 0 | 1 | 1 |
| 7 | `shared/projectDetector.ts` | **B+** | 0 | 2 | 4 |

**Overall session grade: B+ / A-.** Zero CRITICAL. Ship-capable after the MAJORs listed below are addressed; none of them block the governor tier from functioning but several are latent correctness/safety holes.

---

## 1. `driftTrendService.ts` — Grade: A-

### SQL injection
**No injection risk.** Every query uses `.prepare(...).all(?, ?)` / `.get(?)` with positional parameters. Table existence checks use a parameterized `sqlite_master` lookup. The single string interpolation (`'MITHRIL-REG%'`) is a hard-coded literal, not user input. **Clean.**

### MAJOR — Adoption score math is wrong
Lines 269–289: `rogue` counts `governance_events` rows tagged `MITHRIL-REG%`, while `registered` counts `DISTINCT file_path` from `mutations_ledger WHERE registry_artifact_id IS NOT NULL`. These are different units (events vs distinct files) divided against each other to produce a percentage. The JSDoc admits "this is a proxy" but the output is exposed as `AdoptionScore.percentage` and will be charted — users will read a meaningless ratio.

**Fix:** Either (a) count both in the same unit (distinct files, or event count), or (b) return `null` and wait for P2 rogue-intrinsic detection to emit a proper `metadata.registryMatch` tag, as the comment already alludes to.

### MINOR — ISO week edge cases
`isoWeekStart()` (line 92) uses `new Date(dateStr)` — if `timestamp` comes back as a SQLite `DATETIME` string without `T`/`Z`, parsing is implementation-defined across Node versions. Prefer an explicit `Date.parse` + NaN guard, or enforce ISO 8601 at write time.

### MINOR — Division-by-zero guard inconsistency
`percentage` uses `total > 0 ? ... : 0` in `getFixRate` and `getAdoptionScore`, but `computeAlerts` also checks `prev.total > 0`. Good. However `fixRate.total > 10 && fixRate.percentage < 20` (line 324) creates a dead zone where 1–10 violations with 0% fix rate silently pass — intentional? Document the threshold.

### MINOR — `tableExists` called on every method
Each private method re-probes `sqlite_master`. Acceptable for a 30-day report path, but cache per-instance (`this.#tableCache`) if this is ever called in a tight loop.

### Tests
No test file in scope. Verify `driftTrendService.test.ts` exists with: empty DB, populated DB, week bucketing across DST, spike alert thresholds, zero-division cases.

---

## 2. `electron/visualAuditor.ts` — Grade: B+

### Electron security review
- `nodeIntegration: false` ✓
- `contextIsolation: true` ✓
- `sandbox: true` ✓
- `devTools: false` ✓
- `offscreen: true` ✓
- CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'` ✓ (no `connect-src`, no network egress possible)
- Load via `data:` URL — no disk/network surface ✓
- Lifecycle: `finally { if (win && !win.isDestroyed()) win.destroy() }` ✓

Security posture is solid. The items below are correctness and robustness issues, not sandbox escapes.

### MAJOR — Regex-based module stripping violates C13 (Deterministic Surgery)
Lines 109, 112–118, 122–128:
```ts
js = js.replace(/^import\s[^\n]*\n?/gm, '')
js = js.replace(/\bexport\s+default\s+(function|class)\s+(\w+)/, ...)
js = js.replace(/^export\s+default\s+(\w+)\s*;?\s*$/m, ...)
```
Commandment 13 explicitly prohibits regex on source code, and Commandment 15 prohibits raw code string mutation. A multi-line import (`import {\n  a,\n  b\n} from 'x'`) will leave dangling lines. An arrow-function default export (`export default () => ...`) will simply not be matched and the component will be `undefined` in the harness, producing false-positive VISUAL-REG-001s.

**Fix:** Use `@babel/traverse` to remove `ImportDeclaration` nodes and rewrite `ExportDefaultDeclaration` to an assignment on `window.__FlintVisualComponent`. The Babel plugin machinery is already imported.

### MAJOR — `executeJavaScript` string interpolation
Line 365:
```ts
`window.__flintMeasure(${JSON.stringify(flintIds)})`
```
`JSON.stringify` is safe for arrays of strings, but if a `flintId` ever contains characters outside the JSON-escaped set that `executeJavaScript` mis-handles (e.g. lone surrogates), this breaks silently. Safer: pass via an IPC channel or call a pre-registered function with structured clone. At minimum, add `.replace(/\u2028|\u2029/g, ...)` hardening, since `JSON.stringify` does NOT escape U+2028/U+2029 and they terminate JS strings.

Similarly, line 198's `id.replace(/"/g, '\\\\"')` is hand-rolled escaping inside a JS template inside an HTML `data:` URL. Fragile. Use `CSS.escape` or an attribute selector with a known-safe ID scheme.

### MAJOR — Render timeout race
Lines 349–361: the 10s timeout `reject`s, but `loadURL` continues in the background and the `did-finish-load` listener is still attached. If the window isn't destroyed fast enough, a late resolve can call `resolve()` after the promise was already settled. `once` prevents multiple fires, but the `did-fail-load` handler can still race with the timeout. Guard with a `settled` boolean or use `AbortController`.

Also: `offscreen: true` + `show: false` + complex layouts can block `did-finish-load` indefinitely on some GPUs. 10s is aggressive for large Figma payloads; make it configurable via `VisualAuditInput`.

### MINOR — `suggestCssFix` hard-codes tolerance 2
Line 226: `if (widthDelta > 2)` — should use the caller's `tolerance`, not a magic 2. Otherwise a user configuring `tolerance: 5` still gets suggestions for 3px drifts.

### MINOR — Missing `win.webContents.setWindowOpenHandler`
Even with `sandbox: true`, defense-in-depth says lock `setWindowOpenHandler(() => ({ action: 'deny' }))` so transformed code cannot `window.open`. Same for `will-navigate`.

### MINOR — Transformed JS runs `new Function(js)()` (line 183)
Inside the sandbox this is contained, but it's still executing attacker-controlled (or AI-hallucinated) code. Add a length ceiling and a simple `eval` / `Function` / `import(` static scan before invocation so we fail loud instead of silently running malicious payloads the Babel transform happened to pass through.

### MINOR — `componentName` detection can miss common patterns
Not caught: `const Foo = () => ...; export default Foo;` spread across multiple lines, `export { Foo as default }`, or `export default memo(Foo)`. Babel traverse handles all of these; regex doesn't.

### Tests
Pure helpers (`transformVisualSource`, `buildVisualHarnessHtml`, `diffBoxes`, `suggestCssFix`) are nicely extracted. Confirm unit tests exist for: missing flintId, tolerance boundary, multiple drifts, render error propagation, empty expectedBoxes short-circuit.

---

## 3. `visualRegressionStub.ts` — Grade: A

Clean dependency-injection design. The `registerGlassBridge` / `isGlassAvailable` pattern correctly keeps `flint-mcp` free of Electron imports (satisfies process boundary law).

### MAJOR — `ranInGlass: false` returns `ok: true` silently
Lines 160–167: when Glass isn't registered, `runVisualRegressionAudit` returns `ok: true, violations: []`. This means a CI run that expected visual regression checks and ran headless will pass with zero coverage and no indication. The advisory warning is only surfaced by `runVisualRegressionForLinter`; any caller using the lower-level function will get a false green.

**Fix:** Either (a) set `ok: false` + `error: 'Glass bridge unavailable'`, or (b) add an explicit `degraded: true` flag and require callers to handle it.

### MINOR — `resetGlassBridgeForTests` is public
Exported from production module. Fine, but add `@internal` JSDoc so it doesn't pollute IntelliSense for consumers.

### MINOR — `buildGlassUnavailableAdvisory` uses `Date.now()` in the id
Makes snapshot testing and deduplication harder. Prefer a stable id (`visual-reg-unavailable`) so repeat audits don't accumulate duplicate advisory warnings in the violation store.

---

## 4. `domains/healthcare.ts` — Grade: B

AAA escalation intent is correct; the execution has gaps.

### MAJOR — Hard-coded A11Y rule list is incomplete
Lines 33–36: only `A11Y-001` through `A11Y-010` are escalated. The active Warden module contains 50 WCAG 2.1 AA rules (per CLAUDE.md: Phase EXP.6a-ext, 9 rule modules). Any rule numbered A11Y-011+ silently remains at its prior mode in healthcare context — a **silent downgrade bug** for the highest-stakes domain.

**Fix:** Iterate `Object.keys(next.a11y.rules)` or import the rule registry and enumerate dynamically. Never hard-code a count-bounded list for compliance escalations.

### MAJOR — No mithril rule escalation
The Mithril block forces `mode: 'blocking'` (good) but does not tighten individual rules. If a rule was explicitly set to `advisory` in the base policy, it stays advisory even in healthcare mode because per-rule overrides typically win over the top-level mode in `policyEngine`. Verify the precedence or explicitly re-mark per-rule entries.

### MINOR — Duplicate field writes
`conformanceLevel: 'AAA'` and `level: 'AAA'` (both written), `deltaEThreshold` and `deltaE_threshold` (both written). If this is intentional dual-naming for legacy compat, add a comment; otherwise pick one. The duplication is a foot-gun if only one field is consumed downstream.

### MINOR — Returned object is partially shallow-cloned
`rules: { ...policy.a11y.rules }` clones the top level but rule values that are objects (if any rule config becomes object-shaped) will still share references. Today they're strings, so fine, but document the assumption.

---

## 5. `domains/fintech.ts` — Grade: B+

### MAJOR — Touch target enforcement depends on linter support
Line 28: `minTouchTargetPx: FINTECH_MIN_TOUCH_TARGET_PX` and `'MITHRIL-SPC-TOUCH': 'blocking'`. This only works if:
1. `MithrilLinter` reads `policy.mithril.minTouchTargetPx` at audit time
2. `MITHRIL-SPC-TOUCH` is a registered rule ID

Neither is verified in this file, and neither of these names appears in the checklist of common Mithril rule prefixes. If the rule ID is wrong, fintech escalation is a no-op with no error surfaced. **Verify the rule exists before merging** or add a startup assertion.

### MINOR — `conformanceLevel` ternary is redundant
Line 19–20: `policy.a11y.conformanceLevel === 'AAA' ? 'AAA' : 'AA'` simplifies to `policy.a11y.conformanceLevel ?? 'AA'` when the only non-AAA value is undefined/AA. Readability.

### MINOR — No explicit `mode: 'blocking'` on mithril
Unlike healthcare which force-sets `mithril.mode = 'blocking'`, fintech only tightens threshold and touch target. A project with `mithril.mode = 'advisory'` in the base policy gets the fintech policy changes reduced to advice. Intentional? If so, comment. If not, mirror healthcare's pattern.

---

## 6. `domains/government.ts` — Grade: A-

Cleanly composes healthcare + Section 508. The right approach.

### MAJOR — Inherits healthcare's hard-coded rule list bug
Because `applyGovernmentEscalation` calls `applyHealthcareEscalation(policy)` first, any a11y rule > A11Y-010 is silently unescalated before Section 508 runs. Section 508 then re-blocks only A11Y-001..004. Net result: A11Y-011..050 are NOT blocking under government mode. For federal compliance this is a compliance defect.

**Fix:** Fix at the healthcare layer (preferred) or enumerate all rules in `applyGovernmentEscalation` before delegating.

### MINOR — `section508: true` not in `ResolvedPolicy` type surface
If the type doesn't declare `section508`, this relies on structural widening. Verify `ResolvedPolicy.a11y` includes `section508?: boolean` or add it.

---

## 7. `shared/projectDetector.ts` — Grade: B+

Good structure, testable via injected `DetectorFS`. Edge cases need hardening.

### MAJOR — `readFile` returns `Promise<string>` but `exists` returns `boolean`
Async/sync mix on the injected interface (lines 50–55). In tests this is fine; in production, `exists` typically wraps `fs.existsSync`, which is a blocking syscall scattered throughout an async function. Dozens of `fs.exists` calls on cold disk (network mount, CI runners) will stall the event loop. **Make `exists` async** or document the assumption that it's cache-backed.

### MAJOR — Symlink loop
`defaultCountFiles` (line 145) walks recursively using `readdir(..., { withFileTypes: true })`. `Dirent.isDirectory()` follows symlinks by default when the entry itself is a symlink target. A project with a symlink to its own parent (or to `node_modules/.cache` containing a symlink back) will infinite-loop the walker. `SKIP_DIRS` only covers names, not inode identity.

**Fix:** Use `entry.isSymbolicLink()` check + track visited real paths via `fs.realpath`, or cap recursion depth (e.g. 10 levels).

### MINOR — Corrupt `package.json` silently yields defaults
Lines 181–191: `catch {}` swallows parse errors. A developer with a typo'd `package.json` will see "Unknown" framework and won't know why. Log the parse error (at debug level) or propagate a structured `detectionWarning`.

### MINOR — Component library precedence
shadcn is detected via CVA + Radix combo (line 293). But then the subsequent loop skips `shadcn` and `radix` (line 303). If a project uses `class-variance-authority` WITHOUT Radix (standalone CVA), neither branch sets `componentLibrary`, and CVA alone is invisible. Intentional, but add a comment.

### MINOR — `cleanVersion` can return empty string
`'^'.replace(/^[\^~>=<\s]+/, '').split(' ')[0]` → `''`. The framework label becomes `"React "` (trailing space). Guard with `ver ? ... : label` (already partially done on line 203) but trim whitespace.

### MINOR — Next.js / Nuxt extra dirs walked unconditionally
Lines 334–354: walks `pages` and `app` even if they don't exist. `defaultCountFiles` handles this via `fsExists(dir)`, but the injected path (`fs.countFiles`) may not. Document the expectation or add the guard at the caller.

### MINOR — No `README.md` or `tsconfig.json` absolute path sanity
`path.join(projectRoot, 'package.json')` assumes `projectRoot` is absolute. Add a `path.resolve(projectRoot)` at entry, otherwise `./foo` vs `/abs/foo` produces subtly different `detectedAt` shapes.

---

## Cross-cutting findings

### Commandment compliance
- **C13 (No Regex Surgery):** `visualAuditor.ts` lines 109–128 violate this. See MAJOR above.
- **C15 (Granular AST Tools):** Same regex section also violates C15 by mutating code text rather than using Babel traversal.
- **C4 (Local-First):** All vendor loading is local via injected loader. ✓
- **C9 (CIEDE2000):** healthcare/fintech configure `deltaEThreshold` correctly. ✓
- **Process boundary:** `visualRegressionStub.ts` has no Electron imports. ✓ `projectDetector.ts` is under `shared/` and uses `node:path` + dynamic `node:fs/promises` — this is fine for `shared/` (Node-only utility consumed by both electron/ and server/), but **must never be imported from `src/`**. Verify consumers.

### Race conditions
- `visualAuditor.ts`: render timeout vs load completion (MAJOR above).
- `driftTrendService.ts`: concurrent writes to the ledger during aggregation — better-sqlite3 is synchronous but another process holding a write lock can throw. Wrap reads in a retry or document single-process assumption.

### Graceful degradation
- `visualRegressionStub.ts` degrades to advisory (good pattern), but `runVisualRegressionAudit` lies with `ok: true` (MAJOR).
- `projectDetector.ts` degrades to "Unknown" silently (MINOR).

### Test coverage gaps (by observation — not verified)
None of the seven files were accompanied by test files in the review set. Before marking any of these ONLINE per Flint's testing standard:
- `driftTrendService.test.ts` — in-memory SQLite, each aggregation method, alert thresholds, empty states
- `visualAuditor.test.ts` — pure helpers (transform, diff, suggest), plus a mocked BrowserWindow integration test
- `visualRegressionStub.test.ts` — bridge registered/unregistered paths, error path, `resetGlassBridgeForTests`
- `healthcare.test.ts` / `fintech.test.ts` / `government.test.ts` — before/after policy snapshots, rule enumeration, composition (gov = healthcare + 508)
- `projectDetector.test.ts` — corrupt package.json, symlink, missing dirs, each framework, shadcn combo, empty project

Run `npx tsc --noEmit` and `npm test -- --run` before approval. I did not execute them in this review pass — see TODO below.

---

## Must-fix before ship (MAJOR tier, prioritized)

1. **`healthcare.ts`:** enumerate all active a11y rules dynamically — hard-coded `A11Y-001..010` is a compliance defect and cascades to `government.ts`.
2. **`visualAuditor.ts`:** replace regex-based import/export rewriting with Babel traversal (C13/C15).
3. **`visualAuditor.ts`:** harden render timeout race with settled-guard / AbortController.
4. **`visualRegressionStub.ts`:** return `degraded: true` or `ok: false` when no Glass bridge is registered — do not silently report green.
5. **`driftTrendService.ts`:** fix adoption-score unit mismatch or return `null` until proper P2 data lands.
6. **`fintech.ts`:** verify `MITHRIL-SPC-TOUCH` rule ID is registered and that `policy.mithril.minTouchTargetPx` is actually consumed by MithrilLinter.
7. **`projectDetector.ts`:** symlink cycle protection in `defaultCountFiles`.
8. **`projectDetector.ts`:** make `DetectorFS.exists` async, or at minimum avoid calling it inside hot loops.

## Ship with follow-ups (MINOR tier)

Bundle the MINORs into a follow-up ticket. None of them block the governor tier from functioning.

---

## Verdict

**Conditional approve — address MAJORs before merging to main.** The architecture is correct, the process boundary is respected, and the Electron sandbox posture is strong. The defects are specifically in:

- Correctness of compliance escalation (healthcare/government rule enumeration)
- Regex-on-source anti-pattern in visualAuditor
- Silent green in the stub when Glass is absent
- Adoption score math in driftTrendService

None are security-critical. All are fixable in < 1 day of focused work.

### TODO before marking ONLINE
- [ ] Run `cd flint-mcp && npm test` and report counts
- [ ] Run `npm run test:react` and report counts
- [ ] Run `npx tsc --noEmit` and confirm 0 errors
- [ ] Add test files for each of the 7 modules
- [ ] Fix the 8 MAJORs above
- [ ] Re-review the fixed regex section in visualAuditor specifically against C13/C15

— End of review
