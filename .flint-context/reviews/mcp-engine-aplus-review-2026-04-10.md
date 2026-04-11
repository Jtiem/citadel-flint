# MCP Engine Surface Review -- 2026-04-10

## Summary Table

| File | Grade | Critical | Major | Minor |
|------|-------|----------|-------|-------|
| `flint-mcp/src/server.ts` | B+ | 1 | 3 | 4 |
| `flint-mcp/src/core/MithrilLinter.ts` | A- | 0 | 1 | 3 |
| `flint-mcp/src/core/A11yLinter.ts` | A | 0 | 0 | 1 |
| `flint-mcp/src/core/responseMeta.ts` | A | 0 | 0 | 1 |
| `flint-mcp/src/tools/audit.ts` | A- | 0 | 1 | 2 |
| `flint-mcp/src/tools/fix.ts` | B+ | 0 | 2 | 1 |
| `flint-mcp/src/tools/swarm.ts` | B | 1 | 1 | 1 |
| `flint-mcp/src/tools/ingest.ts` | A- | 0 | 0 | 1 |
| `flint-mcp/src/tools/sync.ts` | A- | 0 | 0 | 1 |
| `flint-mcp/src/core/errorResponse.ts` | A+ | 0 | 0 | 0 |

**Overall: B+** -- The MCP surface is mature, humanized, and well-structured. Two critical items and a handful of majors keep it from an A.

**Test suite: 4349/4378 passing (29 failures)**
- `suggestedAction.test.ts`: 27 failures -- `assembleSuggestedAction` is not a function (likely an export rename that broke the test import)
- `project-scaffold.test.ts`: 2 failures -- starter template audit assertion

**TSC: 0 errors** (clean)

---

## Per-File Review

### `flint-mcp/src/server.ts` -- Grade: B+

**CRITICAL-1: Duplicate SQLite connections per project root**
Lines 216-220 vs 236-239. `getAgentRiskService` opens a fresh `provenance.db` connection even though `getProvenanceService` already opened one for the same project root. Same pattern repeats for `getRiskScoringService` (line 298) and `getTrustTierService` (line 238). Each singleton factory opens its own `BetterSqlite3` handle to the same `.db` file. While SQLite handles concurrent readers, this wastes file descriptors and risks WAL contention under load.

**Fix:** Extract a `getDatabase(projectRoot, dbName)` helper that caches one connection per `(root, file)` pair and share it across services.

**MAJOR-1: `flint_fix` writes with raw `fs.writeFileSync` (line 2503)**
Commandment 12 requires all writes through `FileTransactionManager`. The `flint_ast_mutate` handler correctly does atomic `.tmp` + `rename` (line 2141), but `flint_fix` on line 2503 calls `fs.writeFileSync` directly. This is not crash-safe.

**MAJOR-2: `flint_audit` inconsistent response shape**
Single-file audit (line 2430) returns `JSON.stringify(auditResult)` -- a structured object. But `audit_ui_component` (line 1894) returns a formatted markdown string with summary preamble. An IDE agent calling both tools gets different shapes. The batch path also returns raw JSON. This forces the model to parse two different formats.

**MAJOR-3: `as any` casts in mutation switch (lines 1995-2074)**
Every `ast` parameter is cast with `as any`. While the comment at line 156 explains the CJS/ESM interop for `generate`, the AST casts are unguarded. If a mutation function signature changes, these casts silently suppress the error.

**MINOR-1:** `REGISTERED_TOOL_COUNT = 59` (line 428) is a magic number that can drift from the actual tool list. Consider computing it from the `ListToolsRequestSchema` handler.

**MINOR-2:** The `flint_audit` case (line 2411) does not validate that `source` and `filePath` are present before calling `handleFlintAudit`. The tool schema marks them `required`, but the runtime cast does not enforce it. A malformed client call would produce an unhelpful stack trace instead of a `toolError`.

**MINOR-3:** `findProjectRoot` is called inline in multiple handlers but is not defined in the visible portion. If it throws, the generic catch may swallow context.

**MINOR-4:** The `flint_get_context` case (line 1674) uses a hardcoded tool name string `"flint_get_context"` instead of `toolName("get_context")`, breaking the brand abstraction.

### `flint-mcp/src/core/MithrilLinter.ts` -- Grade: A-

**MAJOR-1: CIEDE2000 code duplicated in fix.ts**
The entire CIEDE2000 engine (hexToRgb, srgbToLinear, linearRgbToXyz, xyzToLab, hexToLab, deltaE2000) is copy-pasted between MithrilLinter.ts and fix.ts. Any bug fix in one copy will be missed in the other.

**Fix:** Extract to a shared `colorMath.ts` module.

**MINOR-1:** `parseCssColorToHex` returns the raw hex string for `#RRGGBBAA` (8-digit) inputs without stripping the alpha channel. This means CIEDE2000 will receive a string that `hexToRgb` rejects (not 6 chars after expansion), silently producing `null` and skipping the color.

**MINOR-2:** `visitClassNames` uses a single regex `ARBITRARY_COLOR_RE` that only matches `#hex` in brackets. It misses `rgb()` and `hsl()` in Tailwind arbitrary values like `bg-[rgb(255,0,0)]`. The fix.ts version handles these via `cssColorToHex` but the linter does not.

**MINOR-3:** The `checkStyleProps` function returns only the FIRST violation per node. This is documented ("first-write-wins per node") but means a node with 3 inline style violations only surfaces 1. The audit summary may undercount.

### `flint-mcp/src/core/A11yLinter.ts` -- Grade: A

Clean delegation shim. 50 rules registered across 9 modules. Backward-compatible `audit()` preserved. `auditStructured()` exposed for new callers.

**MINOR-1:** `ensureRulesRegistered` uses a length check that would fail if a consumer accidentally called `registerRules([])` before the A11yLinter. Edge case, but a boolean flag would be more robust.

### `flint-mcp/src/core/responseMeta.ts` -- Grade: A

Tight, well-typed. Timer pattern is ergonomic. Only 3 tools currently use it (`flint_status`, `audit_ui_component`, `flint_query_registry`) -- wider adoption would improve observability.

**MINOR-1:** `durationMs` is rounded to 2 decimal places via `Math.round(... * 100) / 100`. This is fine but inconsistent with the `withResponseMeta` path which accepts raw `durationMs` without rounding.

### `flint-mcp/src/tools/audit.ts` -- Grade: A-

Well-structured. DTCG walk, enforcement resolution, CX.1 summaries, coverage stats all solid. Humanized recommendations.

**MAJOR-1: `source` and `filePath` marked required in schema but not validated at runtime**
`handleFlintAudit` destructures `source` and `filePath` directly (line 271). If the server passes through a malformed request, this produces a confusing Babel parse error on `undefined` rather than a clear "missing parameter" message.

**MINOR-1:** The health score formula in `computeHealthScore` (line 559) uses a flat deduction per violation (critical=-10, amber=-3). With 10 critical violations the score hits 0. This is documented as a known issue in the Counsel redesign memory -- two formulas exist (here and in `debtReportService.ts`). Not new, but still a consistency gap.

**MINOR-2:** `handleFlintAuditBatch` reads each file synchronously in a loop (line 579). For large batches this blocks the event loop. Consider `Promise.all` with a concurrency limiter.

### `flint-mcp/src/tools/fix.ts` -- Grade: B+

**MAJOR-1: CIEDE2000 duplication** (see MithrilLinter MAJOR-1 above). Same code, same risk.

**MAJOR-2: Typography/spacing fix replaces with "first available token"**
Lines 319 and 339: when no exact match is found, the fix blindly picks `typeTokens[0]` or `dimTokens[0]` -- the first token in whatever order the array happens to be in. This could replace `font-[Inter]` with `fontFamily: "Roboto"` if Roboto happens to be first. The linter correctly flags the drift but the fixer's replacement is arbitrary.

**Fix:** Sort candidates by relevance (e.g., string similarity for font families, numeric proximity for dimensions) or skip the fix and leave it for manual review.

**MINOR-1:** `fixInlineStyleValue` (line 360) handles a smaller set of color props than `INLINE_COLOR_PROPS` in MithrilLinter (missing `caretColor`, `accentColor`, `scrollbarColor`, etc.). Violations detected by the linter for these props cannot be auto-fixed.

### `flint-mcp/src/tools/swarm.ts` -- Grade: B

**CRITICAL-2: Raw `fs.writeFileSync` without atomic write (line 246)**
`fs.writeFileSync(fileResult.filePath, fixResult.fixedSource, 'utf-8')` -- direct write, no `.tmp` + `rename`. A crash during write corrupts the file. Commandment 12 violation.

**MAJOR-1: No file count cap**
`discoverFiles` recursively walks the entire project tree. On a monorepo with thousands of `.tsx` files, this could OOM or take minutes. No upper bound or progress feedback.

**MINOR-1:** `discoverFiles` skips all dot-directories (line 156: `entry.name.startsWith('.')`) which would skip `.storybook/` stories -- possibly intentional but undocumented.

### `flint-mcp/src/tools/ingest.ts` -- Grade: A-

Clean, well-typed. Early return on no-tokens is a good UX pattern.

**MINOR-1:** The `status` field uses string literals (`'ok'`, `'no-tokens'`, etc.) but no discriminated union type enforces exhaustiveness at call sites.

### `flint-mcp/src/core/errorResponse.ts` -- Grade: A+

Exemplary. Structured error envelope with causes + recovery. Pre-built hint sets cover the 7 most common failure modes. Stack traces suppressed in production. No findings.

---

## Cross-Cutting Findings

### Response Shape Consistency

Three response patterns coexist:
1. **Humanized markdown** (`audit_ui_component`) -- summary + recommendation + formatted report
2. **Raw JSON** (`flint_audit`, `flint_fix`, `flint_swarm_audit_fix`) -- `JSON.stringify(result)`
3. **Summary + JSON** (`flint_get_context`, resources) -- plain-English preamble followed by JSON blob

Pattern 1 is the best IDE chat experience. Patterns 2 and 3 force the model to parse JSON and re-present it. The inconsistency means agents handle different tools differently.

**Recommendation:** Migrate pattern-2 tools to emit a summary preamble (like `audit_ui_component` does) so the model can relay findings without JSON parsing.

### Test Failures

29 test failures in `suggestedAction.test.ts` -- all `TypeError: assembleSuggestedAction is not a function`. This is a broken import, not a logic failure. The function was likely renamed or its export changed. Should be a quick fix.

2 failures in `project-scaffold.test.ts` -- starter template auditAll assertion. Likely caused by a template change that introduced a new violation.

---

## Prioritized Punch List

| Priority | Item | Files | Effort |
|----------|------|-------|--------|
| P0 | Fix `fs.writeFileSync` in swarm.ts and server.ts flint_fix -- use atomic `.tmp` + `rename` | `swarm.ts:246`, `server.ts:2503` | 30 min |
| P0 | Extract shared CIEDE2000 module to eliminate code duplication | `MithrilLinter.ts`, `fix.ts` -> new `colorMath.ts` | 1 hr |
| P1 | Deduplicate SQLite connections with a shared `getDatabase` cache | `server.ts:160-396` | 1 hr |
| P1 | Add runtime validation for required params in `flint_audit` case | `server.ts:2411` | 15 min |
| P1 | Fix `suggestedAction.test.ts` broken import (27 test failures) | `src/__tests__/suggestedAction.test.ts` | 15 min |
| P2 | Improve fix.ts token replacement strategy (don't blindly pick first token) | `fix.ts:319,339` | 1 hr |
| P2 | Standardize response shape: add summary preamble to JSON-only tools | `server.ts` (flint_audit, flint_fix cases) | 1 hr |
| P2 | Handle `#RRGGBBAA` (8-digit hex) in `parseCssColorToHex` | `MithrilLinter.ts:343` | 15 min |
| P3 | Add file count cap to `discoverFiles` in swarm.ts | `swarm.ts:124` | 15 min |
| P3 | Align `fixInlineStyleValue` color prop set with `INLINE_COLOR_PROPS` | `fix.ts:366` | 15 min |
| P3 | Extend `visitClassNames` to handle `rgb()`/`hsl()` in Tailwind brackets | `MithrilLinter.ts:585` | 30 min |
| P3 | Widen `startResponseTimer` adoption to more tools | `server.ts` | 30 min |
