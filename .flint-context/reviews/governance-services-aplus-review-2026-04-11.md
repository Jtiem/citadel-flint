# Governance Services A+ Code Review

**Date:** 2026-04-11
**Reviewer:** Quality Gate (Opus 4.6)
**Scope:** 8 files in the governance credibility layer
**TSC:** 0 errors
**MCP Tests:** 4350/4378 passing (28 failures in unrelated `suggestedAction.test.ts`)
**Governance-specific tests:** 219/219 passing (risk: 51, anomaly: 26, trustTier: 74, enforcement: 34, configValidator: included, dbom: 34)

---

## File Grades

| # | File | Grade | Blockers | Majors | Minors |
|---|------|-------|----------|--------|--------|
| 1 | `mutationProvenanceService.ts` | **A** | 0 | 0 | 1 |
| 2 | `riskScoringService.ts` | **B+** | 0 | 2 | 2 |
| 3 | `anomalyDetectionService.ts` | **B** | 0 | 3 | 2 |
| 4 | `dbomService.ts` | **B+** | 0 | 2 | 1 |
| 5 | `trustTierService.ts` | **A-** | 0 | 1 | 1 |
| 6 | `enforcementService.ts` | **A** | 0 | 0 | 1 |
| 7 | `rulePackRegistry.ts` | **B+** | 0 | 1 | 2 |
| 8 | `configValidator.ts` | **A** | 0 | 0 | 1 |

**Overall Grade: B+**
Zero blockers. Seven major findings, all fixable without architectural changes.

---

## Findings

### 1. mutationProvenanceService.ts --- Grade A

Excellent implementation. Clean DI pattern, parameterized queries throughout, proper indices, transactional batch inserts.

**MINOR-1: No test file exists for mutationProvenanceService**
There is no `mutationProvenanceService.test.ts` in the `__tests__/` directory. The service is tested indirectly through downstream consumers (riskScoringService, etc.), but the Testing Standard requires direct unit tests for SQLite services covering "CRUD round-trip + each filter + aggregations + pruning + concurrent writes."

*Recommendation:* Add a dedicated test file covering `recordProvenance`, `recordProvenanceBatch`, `getProvenance`, `getProvenanceBySource`, `getProvenanceSummary`, `getAuditTrail`, and `pruneProvenance`.

---

### 2. riskScoringService.ts --- Grade B+

Two distinct APIs coexist in one file: the DB-backed `RiskScoringService` class (0-100 scale) and the stateless `scoreMutation` function (0.0-1.0 scale). Both are well-designed individually.

**MAJOR-1: `RiskScoringService` class has no dedicated tests**
The test file `riskScoringService.test.ts` only tests the stateless `scoreMutation` function, `getTier`, and `getRecommendation`. The class-based `RiskScoringService` with its SQLite persistence, `scoreMutation` (class method), `scoreBatch`, `getFileRiskProfile`, `getProjectRiskSummary`, `getScore`, and `pruneScores` has zero test coverage.

This is a governance credibility service -- it assigns risk tiers that determine whether mutations are auto-approved, reviewed, or blocked. Missing test coverage here is a trust gap.

*Recommendation:* Add tests for the class-based API covering: single mutation scoring, batch scoring, file risk profile with trend detection, project summary aggregation, score retrieval, and pruning.

**MAJOR-2: `queryProvenance` opens a new DB connection on every `scoreMutation` call**
Line 711-736: The stateless `scoreMutation` function calls `queryProvenance`, which opens a `BetterSqlite3` connection, runs a query, and closes it -- on every single invocation. For batch scoring in hot paths (e.g., audit-time risk assessment), this creates N file opens + closes.

```typescript
function queryProvenance(projectRoot: string, filePath: string): number {
    const db = new BetterSqlite3(dbPath, { readonly: true })
    // ...query...
    db.close()
}
```

*Recommendation:* Accept an optional pre-opened DB handle or cache the connection. For the stateless function, at minimum cache per projectRoot with a WeakRef or LRU.

**MINOR-2: Dual scale ambiguity**
Having two scoring systems in one file (0-100 class, 0.0-1.0 function) invites confusion. The `scoreMutation` name is used for both. The file is 860 lines long.

*Recommendation:* Consider splitting into `riskScoringService.ts` (class) and `mrsScorer.ts` (stateless function). Low priority since callers are currently well-separated.

**MINOR-3: `WEIGHTS` sum not validated at compile time**
The five factor weights (0.30, 0.20, 0.20, 0.15, 0.15) sum to 1.0 by inspection, but there is no runtime assertion. If a future edit changes a weight without maintaining the sum, scores silently drift.

*Recommendation:* Add a compile-time or runtime check: `const total = Object.values(WEIGHTS).reduce((a,b) => a+b, 0); if (Math.abs(total - 1.0) > 0.001) throw ...`

---

### 3. anomalyDetectionService.ts --- Grade B

The 3-sigma detection logic is sound. The `computeMeanStddev` function correctly uses population variance (not sample variance), which is appropriate for a full-window baseline.

**MAJOR-3: Dynamic SQL with string interpolation for table/column names**
Lines 385-397, 408-415, 419-429, 445-457, 461-468: Multiple helper methods interpolate table names and column names directly into SQL strings.

```typescript
const sql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsCol} >= ? ${scopeClause}`
```

While the values come from internal string literals (not user input), this pattern is fragile. A future caller passing user-controlled data to `table` or `tsCol` would create an injection vector. The `extraWhere` parameter (e.g., `"event_type = 'violation'"`) is also interpolated directly.

*Recommendation:* Since all table/column names are internal constants, add a whitelist assertion:

```typescript
const ALLOWED_TABLES = new Set(['override_events', 'governance_events', 'mutations_ledger', 'mutation_risk_scores'])
if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`)
```

**MAJOR-4: `computeThreshold` edge case when mean is 0 and stddev is 0**
Line 86-88:
```typescript
function computeThreshold(mean: number, stddev: number, sigmas = 3): number {
    if (stddev === 0) return mean * 1.5
    return mean + sigmas * stddev
}
```

When `mean === 0` and `stddev === 0` (empty history), the threshold becomes `0 * 1.5 = 0`. Any non-zero observed value will trigger an anomaly. This means on a brand-new project with zero baseline data but `dataPoints > 0` (from other metrics), the first override or violation will always flag as anomalous.

The `baseline.dataPoints > 0` guard in `detectAnomalies` partially mitigates this, but the `dataPoints` field is the max across all metric arrays -- if one metric has data but another has none, the zero-threshold metric will still fire.

*Recommendation:* Add a minimum threshold floor: `if (stddev === 0) return Math.max(mean * 1.5, 1)` or require a minimum number of data points per metric before flagging.

**MAJOR-5: Anomaly persistence is not transactional**
Lines 296-299: Each anomaly is persisted individually in a loop. If the process crashes mid-loop, partial anomalies are saved without their siblings, making the detection run non-atomic.

```typescript
for (const anomaly of anomalies) {
    this.persistAnomaly(anomaly)
}
```

*Recommendation:* Wrap in `this.db.transaction(() => { ... })()` for atomicity.

**MINOR-4: `generateId` uses `Math.random` fallback**
Lines 117-125: The fallback to `Math.random` for ID generation is acceptable for non-security use but produces IDs with poor entropy on older runtimes. This is a low risk since Node.js 22 always has `crypto.getRandomValues`.

**MINOR-5: Population vs sample variance**
Line 103: `values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length` uses population variance (divides by N). For baseline computation from a sample of daily counts, sample variance (N-1) is typically more correct. The practical difference is small when N > 10, but for short baselines (e.g., 3-5 days), this underestimates the standard deviation and produces tighter thresholds, leading to more false positives.

*Recommendation:* Switch to `/ (values.length - 1)` for sample variance, or document the design choice.

---

### 4. dbomService.ts --- Grade B+

Well-structured pipeline: core DBOM -> token compliance -> component provenance -> CycloneDX wrapping. Clean separation of concerns.

**MAJOR-6: Disk write uses `fs.writeFileSync` instead of FileTransactionManager**
Lines 422-426:
```typescript
fs.writeFileSync(outputPath, JSON.stringify(dbom, null, 2), 'utf-8')
```

This violates **Commandment 12 (Atomic Queuing)**: "All file writes routed through FileTransactionManager." The `.flint/dbom.json` write is a direct `fs.writeFileSync` call. If the process crashes mid-write, the file is corrupted with no recovery path.

This is in the MCP server process, not the Electron process where FileTransactionManager lives. However, the MCP server should implement its own atomic write pattern (write to temp + rename) or route through an equivalent mechanism.

*Recommendation:* Replace with atomic write: write to `dbom.json.tmp` then `fs.renameSync`. Or import a shared atomic-write utility.

**MAJOR-7: CycloneDX envelope uses specVersion 1.5 but structure may not fully comply**
The CycloneDX 1.5 spec requires `metadata.tools` to be an array of objects with `{ name, vendor, version }` -- this is correct. However, the spec also requires `metadata.component.type` to be one of the enumerated types; `'application'` is valid. The `extensions` field is a Flint-proprietary extension -- CycloneDX 1.5 does not have an `extensions` field at the top level; it uses `properties` for extension data.

*Recommendation:* Move the full DBOM from `extensions['flint:dbom']` to a CycloneDX-compliant location, either as a property with a JSON string value or as a separate linked file. Document the deviation if kept.

**MINOR-6: Double provenance query when `includeProvenance=false`**
Line 361-363: When `includeProvenance` is false, `inferComponentSource` still calls `queryFileProvenance(projectRoot, comp.filePath)`. This opens a DB connection for every component even when provenance is not requested.

```typescript
source: inferComponentSource(
    comp.filePath,
    includeProvenance
        ? (provenance ?? queryFileProvenance(projectRoot, comp.filePath))
        : queryFileProvenance(projectRoot, comp.filePath),  // <-- always queries
),
```

*Recommendation:* Cache the result or skip provenance query entirely when not needed for source inference.

---

### 5. trustTierService.ts --- Grade A-

Clean implementation with proper safety rails: admin never auto-promotes, 3+ red mutations drops to restricted, escalations demote one tier. Good test coverage (74 tests).

**MAJOR-8: Cumulative counters never reset on promotion**
When an agent is promoted from restricted to standard, the `red_mutation_count`, `override_count`, and `escalation_count` remain at their cumulative values. If an agent had 0 red mutations over 3 clean sessions (qualifying for promotion), then later gets 1 red mutation, the cumulative count is 1 -- which prevents any future promotion because `evaluatePromotion` checks `record.redMutationCount === 0`.

This means: once an agent has a single red mutation at any point in its lifetime, it can never be promoted again (except via `resetTrust` or `manualPromote`). This is either intentional strictness or a fairness bug depending on the design intent.

*Recommendation:* Document this as intentional ("one strike, manual recovery required") or add a sliding window (e.g., last N sessions) for promotion eligibility.

**MINOR-7: `security_validation` and `governance_signoff` gates are no-ops**
Lines 157-158:
```typescript
const securityOk = gates?.security_validation !== true || true  // no-op placeholder
const govOk = gates?.governance_signoff !== true || true        // no-op placeholder
```

These always evaluate to `true`. The comments say "no-op placeholder" which is honest, but the config YAML accepts these values and silently ignores them. Users may believe they are enforcing security validation gates when they are not.

*Recommendation:* Either implement the gates or log a warning when the config specifies them: "security_validation gate is not yet implemented -- this setting has no effect."

---

### 6. enforcementService.ts --- Grade A

Excellent pure-function design. No side effects, no DB dependency, clean defaults that preserve backward compatibility. The precedence chain (block > auto_fix > warn > pass) is correct and well-documented.

**MINOR-8: Comment says "block > warn > auto_fix > pass" but code implements "block > auto_fix > warn > pass"**
Line 237 comment: "Precedence: block > auto_fix > warn > pass"
Line 218 JSDoc: "Precedence order: block > warn > auto_fix > pass"

The code (lines 240-242) implements block > auto_fix > warn > pass, which is correct behavior. The JSDoc at line 218 has the wrong order.

*Recommendation:* Fix the JSDoc comment at line 218 to match the actual precedence.

---

### 7. rulePackRegistry.ts --- Grade B+

Comprehensive rule catalog with 106 rules across 10 packs. Good domain taxonomy and jurisdiction mapping.

**MAJOR-9: `getActivePackIds` parses YAML with regex instead of a YAML parser (C13 adjacent)**
Lines 420-462: The `extends` field is parsed using regex pattern matching on raw YAML text:

```typescript
const raw = fs.readFileSync(configPath, 'utf-8')
if (/^extends\s*:\s*\[\s*\]/m.test(raw)) { return [] }
const inlineMatch = raw.match(/^extends\s*:\s*\[([^\]]+)\]/m)
```

While this is not source code modification (C13 targets source code, not config files), it is fragile. YAML edge cases like multi-line strings, anchors, comments between items, or quoted brackets will break these regexes. The project already has a config loader (`config-loader.ts`) that properly parses YAML.

*Recommendation:* Use the existing `loadFlintConfig` from `config-loader.ts` or import the YAML parser directly. The `extends` field is already typed in `FlintProjectConfig`.

**MINOR-9: `ruleCount` field could drift from `rules.length`**
Each pack declares `ruleCount: N` separately from the `rules` array. If rules are added or removed without updating `ruleCount`, they drift. Example: WCAG 2.1 AA pack says `ruleCount: 50` and has 50 rules in the array -- correct today, error-prone tomorrow.

*Recommendation:* Derive `ruleCount` from `rules.length` at registration time, or add a compile-time check.

**MINOR-10: `fs` and `path` imports for a "static registry"**
The file is described as a "static TypeScript registry" in its header comment, but it imports `fs` and `path` for the `getActivePackIds` function. This function belongs in the config layer, not the static registry.

*Recommendation:* Move `getActivePackIds` to `config-loader.ts` or a separate `rulePackResolver.ts`.

---

### 8. configValidator.ts --- Grade A

Solid defensive validation. Collects all errors in one pass, never throws, uses dot-notation paths matching YAML keys. Good coverage of cross-field validation (delta_e_critical > delta_e).

**MINOR-11: No validation for `enforcement` section**
The config validator covers `project`, `schema_version`, `domain`, `classification`, `rules`, `trust`, `scoring`, `extends`, and `tighten_only`. The `enforcement` section (used by `enforcementService.ts`) is not validated. Invalid enforcement point configurations are silently accepted.

*Recommendation:* Add validation for `enforcement.decision_points` (must be array of strings) and `enforcement.points` (each point must have valid `block_on`/`warn_on`/`apply_on` values from the RuleMode enum).

---

## Commandment Compliance Summary

| Commandment | Status | Notes |
|-------------|--------|-------|
| C3 (Fresh Parse) | PASS | No AST mutation in these files |
| C7 (ID Preservation) | PASS | No structural ops |
| C10 (History Clear) | N/A | No editor state |
| C12 (Atomic Queuing) | WARNING | `dbomService.ts` uses raw `fs.writeFileSync` (MAJOR-6) |
| C13 (No Regex Surgery) | WARNING | `rulePackRegistry.ts` uses regex to parse YAML (MAJOR-9, config not source code) |
| C15 (AST Catalog) | N/A | No AI orchestration |
| C16 (TSC Loop) | N/A | No AI output |

## Process Boundary Compliance

| Check | Status |
|-------|--------|
| No Node.js imports in `src/` | PASS -- all files are in `flint-mcp/` |
| No `@anthropic-ai/sdk` in `src/` | PASS |
| No secrets/API keys | PASS |

## Test Coverage Gaps

| Service | Tests Exist | Coverage Level |
|---------|-------------|----------------|
| mutationProvenanceService | NO | Zero direct tests |
| RiskScoringService (class) | NO | Zero tests for DB-backed class |
| scoreMutation (function) | YES | 51 tests, good coverage |
| AnomalyDetectionService | YES | 26 tests, adequate |
| dbomService | YES | 34 tests, good coverage |
| TrustTierService | YES | 74 tests, excellent |
| enforcementService | YES | 34 tests, good coverage |
| configValidator | YES | Has tests, adequate |
| rulePackRegistry | NO | No dedicated test file |

---

## Recommended Fix Priority

1. **MAJOR-1** (RiskScoringService class tests) -- trust gap in a credibility service
2. **MINOR-1** (mutationProvenanceService tests) -- per Testing Standard
3. **MAJOR-4** (zero-threshold anomaly false positives) -- affects new project experience
4. **MAJOR-6** (non-atomic DBOM write) -- C12 compliance
5. **MAJOR-3** (SQL string interpolation whitelist) -- defense in depth
6. **MAJOR-5** (non-transactional anomaly persist) -- data integrity
7. **MAJOR-9** (regex YAML parsing) -- fragility
8. **MAJOR-2** (DB connection per scoreMutation call) -- performance
9. **MAJOR-8** (cumulative counters blocking promotion) -- fairness decision
10. **MAJOR-7** (CycloneDX compliance) -- spec correctness

---

**Verdict: No blockers. Approved with 9 major findings recommended for next sprint.**

The governance services are architecturally sound with clean separation of concerns, proper DI patterns, and comprehensive type safety. The main gaps are test coverage for two services (mutationProvenance and RiskScoringService class), a few defensive coding improvements in anomaly detection, and the DBOM atomic write issue. None of these are ship-blocking, but fixing them before the next external audit would strengthen Flint's credibility story.
