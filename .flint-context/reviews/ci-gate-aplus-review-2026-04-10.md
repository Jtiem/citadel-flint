# Flint CI/CD Gate -- A+ Code Review

**Reviewer:** Quality Gate  
**Date:** 2026-04-10  
**Scope:** 8 files in `flint-ci/src/`

## Summary Table

| File | Grade | Critical | Major | Minor |
|------|-------|----------|-------|-------|
| `cli.ts` | **A** | 0 | 0 | 1 |
| `engine.ts` | **A-** | 0 | 2 | 1 |
| `commands/audit.ts` | **A-** | 0 | 1 | 2 |
| `commands/debt.ts` | **B+** | 0 | 2 | 1 |
| `commands/sync-check.ts` | **A** | 0 | 0 | 2 |
| `commands/dbom.ts` | **A** | 0 | 0 | 2 |
| `commands/fix.ts` | **A-** | 0 | 1 | 1 |
| `github-action.ts` | **A** | 0 | 1 | 2 |

**Overall: A-** -- Zero critical issues. Solid production-grade CI gate. 7 major items and 12 minor items across 8 files.

---

## Per-File Review

### 1. `cli.ts` -- Grade: A

Clean Commander setup. Exit codes documented and consistent (0/1/2/3). Error handling is uniform across all subcommands.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | Exit code 2 (usage error) is documented but never emitted. Commander handles usage errors itself with its own exit behavior. Consider `program.exitOverride()` to control Commander's exit codes if you want 2 to actually appear. |

### 2. `engine.ts` -- Grade: A-

Zero-copy delegation to MCP engine is well-executed. SARIF output is spec-compliant.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MAJOR | **SARIF `$schema` URL points to GitHub raw content** (line 647-648). GitHub Code Scanning accepts this, but the canonical SARIF 2.1.0 schema URL is `https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json`. The current URL will break if the OASIS TC reorganizes their GitHub repo. Low probability, but for a governance tool this should be authoritative. |
| 2 | MAJOR | **`auditAll` return value assumed to be `Map`** (line 259). `Array.from(warnings.values())` only works if `auditAll` returns a Map. If the MCP engine changes this to return an array, this silently fails to flatten. Add a type assertion or handle both shapes. |
| 3 | MINOR | **A11y violations lack SARIF rule definitions** (line 631-643). A11Y rules get dynamically generated rule entries with generic descriptions ("Flint governance rule A11Y-NNN"). Consider adding the top 10 A11Y rules to `SARIF_RULE_DEFINITIONS` for richer GitHub Code Scanning integration (rule descriptions appear in the Security tab). |

### 3. `commands/audit.ts` -- Grade: A-

Excellent feature set: baseline suppression, content-hash caching, .flintignore, CX.3 error taxonomy enrichment. Well-structured.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MAJOR | **Cache skips files but summary counts are wrong** (lines 307-340). When `--cache` is used, cached files are excluded from `files[]` and therefore excluded from `summary.totalFiles`. The reported "Files scanned" count will show only non-cached files, which is misleading. A CI log showing "Files scanned: 3" when 200 files exist will confuse users. Fix: track cached files separately and add their counts to the summary. |
| 2 | MINOR | **`--fix` after audit re-imports fixCommand** (line 435). The dynamic `import('./fix.js')` is fine, but the paths passed to `fixCommand` differ from the audit's resolved paths. Audit resolves and deduplicates, but the fix call passes raw `paths` or `[projectRoot]`. If the user passed a glob that expanded to specific files, the fix might scan a broader set. |
| 3 | MINOR | **Error taxonomy pre-cache loop** (lines 50-59) iterates 0-59 for each prefix. Harmless but wasteful -- most iterations find nothing. A lookup-on-demand pattern would be cleaner. |

### 4. `commands/debt.ts` -- Grade: B+

Functional but has structural issues.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MAJOR | **Inlined `formatHealthSignal` duplicates the formula from `shared/healthSignal.ts`** (lines 22-34). The doc comment says "avoids cross-package rootDir issues" but this creates exactly the dual-formula problem flagged in the Counsel redesign memory (`project_counsel_governance_redesign.md`). If the weights change in `shared/healthSignal.ts`, this copy drifts silently. Fix: either import from shared (fixing the rootDir issue properly) or add a comment with the canonical location and a test that asserts parity. |
| 2 | MAJOR | **`_paths` parameter is accepted but ignored** (line 63). The debt command accepts `[paths...]` from the CLI but passes only `projectRoot` and a hardcoded `'**/*.tsx'` glob to `generateDebtReport`. Users who run `flint-gate debt src/components/` will get a full-project report, not a scoped one. Either remove the paths arg from the CLI definition or wire it through. |
| 3 | MINOR | **Health sub-score lookup uses arbitrary category keys** (lines 132-135). `report.byCategory['design-system']` and `report.byCategory['color']` are tried as fallbacks for Mithril count. If the MCP engine changes category names, this silently returns 0. |

### 5. `commands/sync-check.ts` -- Grade: A

Clean dual-path architecture (MCP engine with SQLite, fallback to JSON file). Proper resource cleanup with `finally` block on the DB connection.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | **No staleness threshold for `lastSyncAt`** (line 95). The command reports last sync time but never warns if it was weeks ago. A simple "Last sync was 14 days ago -- consider running sync" would be actionable. |
| 2 | MINOR | **SyncState type is locally defined** (lines 19-38) rather than imported from the MCP engine. If the engine's sync state shape changes, this won't catch it at compile time. |

### 6. `commands/dbom.ts` -- Grade: A

Clean fallback chain (governance DBOM -> core DBOM -> error). Good separation of Markdown formatters.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | **Markdown table values not escaped** (lines 199, 216, etc.). Token values or file paths containing `|` will break table formatting. Pipe-escape with `\|`. |
| 2 | MINOR | **Core DBOM fallback outputs JSON for CycloneDX format** (line 101-102). Comment acknowledges this but the user gets JSON when they asked for CycloneDX, with no warning. Add a stderr note: "CycloneDX format requires the governance DBOM service. Falling back to JSON." |

### 7. `commands/fix.ts` -- Grade: A-

Dry-run default is correct and well-implemented. Fallback audit-and-report mode is a good degraded UX.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MAJOR | **Fallback mode never actually writes files** (lines 186-284). When the MCP fix module is unavailable, `auditAndReport` identifies fixable violations and prints "Would fix" / "Fix" messages, but in `--no-dry-run` mode it still never modifies any file. The user sees "Fix: ..." lines suggesting fixes were applied, but nothing changed on disk. This is confusing. Either: (a) implement the actual fix logic in the fallback, or (b) clearly state "MCP fix engine unavailable -- showing report only, no files modified" when `dryRun === false`. |
| 2 | MINOR | **`.flintignore` not applied in fix command** (line 79-98). The audit command respects `.flintignore` but the fix command's file collection does not load or apply ignore patterns. |

### 8. `github-action.ts` -- Grade: A

Strong GitHub Actions integration: paginated PR file listing, upsert comment pattern, SARIF output, inline annotations, delta computation, proper `core.setFailed`.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MAJOR | **Delta computation is O(files * git-show) and runs `auditFiles` per base file** (lines 147-200). For a PR touching 50 files, this runs 50 `git show` commands + 50 separate audits. This can significantly slow down the action. Consider batching: collect all base file contents first, then run a single `auditFiles` call. |
| 2 | MINOR | **`parseSource` is imported but unused** (line 27). Dead import. |
| 3 | MINOR | **`_collectSourceFiles` alias** (line 133). The rename `_collectSourceFiles -> collectSourceFiles` is unnecessary -- just import it directly as `collectSourceFiles`. |

---

## Cross-Cutting Concerns

### SARIF Spec Compliance

The SARIF output is **GitHub Code Scanning compatible**. Verified:
- Schema version `2.1.0` is correct
- `tool.driver.rules[]` populated with used rules only (good practice)
- `uriBaseId: '%SRCROOT%'` is the correct convention for GitHub
- `level` values are from the valid enum (`error`, `warning`, `note`, `none`)
- `region.startColumn` is 1-indexed (line 571 adds +1) -- correct per spec

One gap: the SARIF `runs[0].invocations` array is missing. Not required by GitHub, but the spec recommends it for tool execution metadata (exit code, start/end time). MINOR.

### Exit Code Conventions

| Code | Meaning | Compliance |
|------|---------|------------|
| 0 | Pass | Correct -- used consistently |
| 1 | Violations found / blocked | Correct -- standard for linter failure |
| 2 | Usage error | Documented but not emitted (Commander handles this) |
| 3 | Config / runtime error | Correct -- consistent across all commands |

This is sound. Code 2 is a documentation-only issue.

### Dry-Run Safety

The `fix` command defaults to `--dry-run true` (line 121 of cli.ts, line 53 of fix.ts). In dry-run mode, the MCP engine path passes `dry_run: true` to `handleFlintFix`. The fallback path never writes. **Dry-run is genuinely non-destructive.**

### Error Messages

Actionable across the board. Examples:
- "Run: cd flint-mcp && npm install" (dbom.ts:47)
- "Run 'flint-gate fix' manually" (audit.ts:442)
- "Run with --no-dry-run to apply these fixes" (fix.ts:350)

### Missing Edge Cases

| Scenario | Handled? |
|----------|----------|
| No files matched | Yes -- returns 0 with message (audit.ts:300) |
| Invalid glob | Partially -- individual path errors caught, but glob expansion errors swallowed |
| Permission denied on file | Yes -- caught per-file with warning (audit.ts:329) |
| No git repo (--changed) | Yes -- falls back gracefully (audit.ts:106) |
| No tokens file | Yes -- warns and continues (audit.ts:246) |
| Malformed JSON tokens | Yes -- returns empty array (engine.ts:163) |
| Binary file in source tree | Handled -- Babel parse failure caught, reported as FLINT-PARSE |

### Test Coverage

Only 2 test files exist (`engine.test.ts`, `commands.test.ts`). No tests found for:
- `github-action.ts` (the highest-risk file for external-facing behavior)
- `commands/fix.ts` fallback mode
- `commands/baseline.ts`
- `utils/files.ts` (.flintignore pattern matching, cache round-trip)

This is a **gap** for a governance product. Not graded as CRITICAL because the MCP engine has its own test suite, but the CI-specific logic (file collection, caching, baseline suppression, SARIF generation, delta computation) should have dedicated tests.

---

## Prioritized Punch List

### Must Fix (Major)

1. **fix.ts fallback misleads in `--no-dry-run` mode** -- Print explicit "report only" message when MCP fix engine is unavailable
2. **debt.ts ignores `paths` argument** -- Wire paths through or remove from CLI definition
3. **debt.ts duplicates health formula** -- Import from shared or add parity test
4. **audit.ts cache skews file counts** -- Track cached file counts separately in summary
5. **github-action.ts delta is O(n) git-show** -- Batch base file collection
6. **engine.ts SARIF schema URL** -- Use canonical OASIS URL
7. **engine.ts `auditAll` return type assumption** -- Add defensive check

### Should Fix (Minor)

8. Add `.flintignore` support to `fix.ts` file collection
9. Add top A11Y rules to SARIF_RULE_DEFINITIONS
10. Escape pipe characters in DBOM markdown tables
11. Warn when CycloneDX falls back to JSON in core DBOM path
12. Add staleness warning to sync-check
13. Remove unused `parseSource` import from github-action.ts
14. Add `invocations` to SARIF output
15. Add tests for: github-action PR comment, SARIF generation, baseline suppression, .flintignore patterns, audit cache round-trip
