# A+ Review — Policy Engine, Error Taxonomy, MCP Server Registration

**Date:** 2026-04-12
**Scope:** policyEngine.ts, errorTaxonomy.ts, server.ts, configValidator.ts, config-loader.ts
**Reviewer:** /review quality gate

## Executive Summary

| File | Grade | Key issue |
|------|-------|-----------|
| `policyEngine.ts` | **D** | Entirely orphaned from the MCP surface; rule allow-lists are stale; team overlay logic is unreachable |
| `errorTaxonomy.ts` | **A-** | 76 complete entries, strong authority coverage; minor drift vs. policy allow-lists |
| `server.ts` | **B** | Registrations complete and wired, but duplicated handlers, schema drift, and no runtime input validation |
| `configValidator.ts` | **B+** | Clean pure function, collects all errors, but doesn't validate `export_gate`, `extends`, or environments recursively |
| `config-loader.ts` | **B-** | Solid YAML path, but silent fallbacks, missing path sandboxing, and tighten_only is advisory-only |

**Top line:** The policy stack has bifurcated. `policyEngine.ts` (POL.1 — 842 LOC, fully tested, implements team overlays + domain escalation + v1→v2 migration + validation) is **not connected to any MCP tool, resource, or write path.** Meanwhile `policyLoader.ts` → `config-loader.loadPolicy()` services every runtime caller and knows nothing about teams, domains, or the v2 schema. This is the single largest finding in the review.

---

## Critical Findings

### CRITICAL-1: `policyEngine.ts` is orphaned from the MCP surface

**Evidence:** `resolvePolicy`, `validatePolicy`, `applyDomainEscalation`, team overlays, and v1→v2 migration are referenced only by tests, pack assembler/importer, and domain files. `server.ts` imports from `policyLoader.ts` (line 30), which delegates to `config-loader.loadPolicy()`. No code path calls `policyEngine.resolvePolicy(projectRoot, teamId)`.

**Impact:**
- `flint_set_policy` reads/writes via `readPolicy` (config-loader), so users cannot set domain, teams, or per-rule modes even though the validator and resolver exist.
- Healthcare/fintech/government domain escalation (`applyHealthcareEscalation`, etc.) is dead code at runtime.
- Team overlays (`TeamOverlay`, `TeamRegistryOverlay`) have full type support and coerce paths but nothing consumes them.
- `flint_audit` and `audit_ui_component` resolve thresholds through `flintConfig`/`FlintPolicy`, not `ResolvedPolicy`, so per-rule `blocking|normative|advisory|off` modes are NOT enforced at the gate.

**Fix:**
1. Collapse `policyLoader.ts` + `config-loader.loadPolicy` to one path that returns `ResolvedPolicy`.
2. Have `flint_set_policy` round-trip through `policyEngine.validatePolicy` before writing.
3. Flint audit/debt/export-gate call sites must consume `getRuleMode(ruleId, policy)` rather than the legacy `FlintPolicy.mithril.mode` single value.
4. Add a `teamId` optional parameter to `flint_audit` / `flint_get_context` and thread it to `resolvePolicy`.

### CRITICAL-2: `KNOWN_MITHRIL_RULES` and `KNOWN_A11Y_RULES` are desperately out of date

**Evidence:** `policyEngine.ts:185-215`.

- `KNOWN_MITHRIL_RULES` is missing these ruleIds which exist in `errorTaxonomy.ts` and ship in `MithrilLinter`:
  - `MITHRIL-IST-COL`, `MITHRIL-IST-TYP`, `MITHRIL-IST-SPC`, `MITHRIL-IST-SHD`, `MITHRIL-IST-OPC` (inline-style rules)
  - `MITHRIL-DTO-001` (design-token override)
  - `MITHRIL-TW-001`, `MITHRIL-TW-002` (Tailwind v3/v4 drift)
  - `MITHRIL-DARK-001` (dark mode)
  - `MITHRIL-REG-001` (registry composition)
- `KNOWN_A11Y_RULES` lists only `A11Y-001..A11Y-010`. The taxonomy and Warden ship: `A11Y-011..017`, `A11Y-020..022`, `A11Y-030..038`, `A11Y-050..053`, `A11Y-060..062`, `A11Y-070..073`, `A11Y-100..103` — 50+ rules missing.

**Impact:** Any valid policy that sets a per-rule mode on e.g. `A11Y-011` is rejected by `validatePolicy` as "unknown rule ID." If anyone actually wired `validatePolicy` into `flint_set_policy`, it would break every production policy. Because the engine is orphaned (CRIT-1), this has hidden so far — the bug ships but nobody sees it.

**Fix:** Generate `KNOWN_*_RULES` from `errorTaxonomy.REGISTRY` at module load. Single source of truth.

```ts
import { getAllErrors } from './errorTaxonomy.js'
const KNOWN_MITHRIL_RULES = new Set(
  getAllErrors().filter(e => e.category === 'mithril').map(e => e.ruleId)
)
```

### CRITICAL-3: Policy loader duplication (`policyLoader.ts` vs `policyEngine.loadPolicy` vs `config-loader.loadPolicy`)

**Evidence:** Three functions named `loadPolicy` exist in the codebase:
- `policyEngine.loadPolicy(projectRoot)` → `ResolvedPolicy` (v2, domain escalation, rich)
- `config-loader.loadPolicy(projectRoot)` → `FlintPolicy` (v1, deep-merged defaults)
- `policyLoader.readPolicy(projectRoot)` → re-exports config-loader.loadPolicy

They read the same `.flint/policy.json` file but return different shapes with different semantics. The v2 migration in `policyEngine.migrateV1ToV2` is bypassed whenever `config-loader` is the entry point (which is always, at runtime). Two code paths silently diverge on startup.

**Fix:** Delete `policyLoader.ts` entirely. Make `config-loader.ts` the SPI, but have it delegate to `policyEngine.resolvePolicy` and adapt the shape if downstream consumers still need `FlintPolicy`.

---

## Major Findings

### MAJOR-1: `configValidator.ts` misses three critical sections

**Evidence:** `configValidator.ts` validates `project`, `schema_version`, `domain`, `classification`, `rules.mithril`, `rules.accessibility`, `trust.default_tier`, `scoring.weights`, `extends`, `tighten_only` — but does NOT validate:

- `rules.export_gate` — any garbage in this block is silently accepted. `block_on_overrides`, `block_on_mithril`, `block_on_a11y` could be strings, numbers, arrays — no check.
- `rules.baseline.enabled` — not checked.
- `environments.<env>.*` — not recursively validated. A bad overlay slips past, then `applyEnvironmentOverlay` mergesit into the resolved config.
- `trust.profiles`, `trust.approval`, `trust.escalation` — zero validation, yet these feed the agent policy and escalation rules engines.
- `enforcement` — the entire section is untouched.
- `content`, `audit`, `review`, `tokens`, `labels` — untouched.

**Fix:** Extend `validateProjectConfig` to cover `export_gate`, `environments` (recursive), `trust.profiles[].id/tier`, and `enforcement.mode`. The helper is already collecting errors in one pass — adding cases is cheap.

### MAJOR-2: `config-loader.loadYamlConfig` uses permissive type cast instead of validator result

**Evidence:** `config-loader.ts:84-103`:
```ts
const config = parsed as FlintProjectConfig
// Validate: 'project' is the only required field
if (!config.project || typeof config.project !== 'string') { ... }
// Run full structural validation — log warnings but do not block loading
const validationErrors = validateProjectConfig(parsed)
if (validationErrors.length > 0) { console.warn(...) }
return config
```

`validateProjectConfig` returns errors but the config is returned regardless. Invalid YAML silently degrades. A `delta_e_critical <= delta_e` YAML config is logged then happily used. There is no `strict` mode to promote validation errors to load failures.

**Fix:** Accept a `{ strict?: boolean }` option on `loadConfig` and in CI mode (`flint-ci`) fail loudly on any validation error. Also emit a structured `config-validation` event rather than only `console.warn` so Glass/VSCode can surface it.

### MAJOR-3: `config-loader.resolveExtendsRef` lacks path sandboxing

**Evidence:** `config-loader.ts:343-359`:
```ts
if (ref.startsWith('./') || ref.startsWith('../')) {
    return path.resolve(projectRoot, ref)
}
if (path.isAbsolute(ref)) {
    return ref
}
```

A malicious `extends: ['../../../../etc/passwd']` resolves to an arbitrary absolute path, then `loadYamlFile` happily `readFileSync`s it. Parsing failure is the only stop-gap. A pack with absolute paths could drag in any YAML from the host filesystem (for extraction/exfiltration via environment-dependent resolution).

**Fix:** Require extends paths to resolve to either `PRESETS_DIR/*.yaml` or a path that is `path.resolve(projectRoot, ref).startsWith(projectRoot + path.sep)`. Absolute paths from user YAML should be disabled by default and gated behind an explicit `unsafe_absolute_extends: true` flag.

### MAJOR-4: `config-loader.applyEnvironmentOverlay` strips `environments` after merge — but only at top level

**Evidence:** `config-loader.ts:148`:
```ts
environments: undefined,
```

This hides further env resolution — but nothing prevents a circular `extends` chain (parent imports a file which imports back). The `seen` set is only applied in `resolveExtends`, not in `loadYamlFile`. Because `resolveExtends` recurses with `parentRoot = path.dirname(filePath)`, the same file referenced with two different ref strings (`./a.yaml` vs `../dir/a.yaml`) can be loaded twice. Minor performance hit and potential for unexpected merge semantics.

**Fix:** Canonicalize ref paths (`fs.realpathSync`) before adding to `seen`.

### MAJOR-5: `server.ts` ListToolsRequestSchema handler has 59 tools but no runtime input validation

**Evidence:** `server.setRequestHandler(CallToolRequestSchema, ...)` at line 1761 has ~60 `case` branches. Input is pulled directly out of `request.params.arguments` with cast assertions — no Zod, no Ajv, no schema-to-runtime validator. The `inputSchema` objects exist purely for client-side hinting.

**Impact:**
- Any required field missing → hits a `TypeError` deep inside the handler, returns a vague MCP error.
- Enum violations (e.g. `action: "foo"` for `flint_agent_trust`) fall through switch statements and default to undefined behavior (no `default` in many switches).
- Numbers that the schema types as `number` can arrive as strings from loose clients — no coercion.

**Fix:** Generate Zod schemas from the inputSchema objects (or hand-write them alongside) and run `parse()` at the top of each case. This mirrors the existing `shared/ipc-validators.ts` pattern used for Electron IPC.

### MAJOR-6: `flint_set_policy` action=update doesn't use `policyEngine.validatePolicy`

**Evidence:** `server.ts:2805-2862` (update branch). Reads via `readPolicy`, merges via `mergePolicy` from `policyLoader.ts`, writes directly. No call to `validatePolicy` — user can POST `{mithril: {deltaE_threshold: -5}}` or `{a11y: {rules: {'MITHRIL-COL': 'off'}}}` (wrong namespace!) and it writes successfully.

**Fix:** Route every write through `policyEngine.validatePolicy`. If invalid, return the `errors: string[]` to the caller. This is a direct CRIT-1 dependency.

### MAJOR-7: Resource `flint://rules` returns raw rule JSON but no provenance or pack info

**Evidence:** `server.ts:1393-1416`. Iterates `domainRegistry.list()` and reads files from disk. Rule packs (64 rules across 10 packs from `rulePackRegistry.ts`) are not surfaced here. A client reading `flint://rules` sees only the domain-folder rules and has no way to discover which rules come from enabled packs, which are overridden, or which are advisory vs. blocking.

**Fix:** Augment this resource with `ruleMode` (from resolved policy), `sourceAuthority` (from errorTaxonomy), and `pack` (from rulePackRegistry). This is the canonical rule-discovery endpoint and it currently under-delivers.

### MAJOR-8: `shouldBlockExport` severity floor comparison has an amber/advisory collision

**Evidence:** `policyEngine.ts:628-646`:
```ts
const SEVERITY_RANK: Record<string, number> = {
    info: 1,
    amber: 2,
    advisory: 2,  // 'advisory' is treated as equivalent to 'amber'
    warning: 2,
    critical: 3,
}
```

Then:
```ts
if (mode !== 'blocking' && mode !== 'normative') { continue }
if (meetsFloor(violation.severity, floor)) { return true }
```

Reusing `'advisory'` as both a `PolicyMode` and a severity label is a category error. The mode name should never appear in a severity map. A violation whose `severity: 'advisory'` (not a declared value in the `'info' | 'warning' | 'critical' | 'amber'` union) gets rank 2 only because `SEVERITY_RANK` happens to include the stray key.

**Fix:** Drop `advisory` from `SEVERITY_RANK`. Severity is a closed union — keep it that way.

---

## Minor Findings

### MINOR-1: `policyEngine.resolvePolicy` team overlay merge loses `ignore_patterns`

`resolvePolicy` at line 533 uses shallow `{ ...project, ...overlay }` for the mithril section. If overlay.mithril has `{mode: 'advisory'}` but omits `ignore_patterns`, the project `ignore_patterns` is preserved by the spread — OK. But if overlay.mithril has `{ignore_patterns: ['foo']}` it REPLACES the project list rather than merging. This may be intentional, but it's not documented.

### MINOR-2: `config-loader.deepMergeConfigs` uses non-deep merge for `trust.profiles`, `trust.approval`, `trust.escalation`

Lines 208-218: `profiles: override.trust?.profiles ?? base.trust?.profiles`. Override wins completely — no per-profile merge. A child config that defines a single profile nukes the parent's entire profile list. Combined with tighten_only being advisory, this is a silent governance regression vector.

### MINOR-3: `errorTaxonomy.getErrorEntryByRuleId` is O(n) and unmemoized

Line 1451: iterates `Object.values(REGISTRY)` on every call. The linter hot loop calls this per warning. Build a reverse index at module init: `const BY_RULE_ID = Object.fromEntries(Object.values(REGISTRY).map(e => [e.ruleId, e]))`.

### MINOR-4: `errorTaxonomy.ts` has `severity: 'error'` and `severity: 'critical'` but no consumer distinguishes them

Mixed usage: `FLINT-MITH-001` is `'error'`, `FLINT-A11Y-001` is `'error'`, `FLINT-SES-*` is `'critical'`. There's no runtime code that branches on this field. Either collapse to one value or document the distinction (e.g. `'error'` = blocking, `'critical'` = ledger-escalation).

### MINOR-5: `server.ts` CallToolRequestSchema handler has ~2400 LOC in one function

The mega switch statement at line 1761 is unmaintainable. Each case should be extracted into `tools/<toolName>.handler.ts` with a common `(args, ctx) => result` signature. Current layout makes it impossible to code-review one tool in isolation.

### MINOR-6: `server.ts:1263` ListResourcesRequestSchema lists `flint://governance/trends` but CLAUDE.md documents 13 resources and the count there reads as 13. governance/trends IS listed. OK — consistency verified. But `flint://capabilities` is emitted via `CAPABILITIES_RESOURCE` spread and is the 14th resource. Update CLAUDE.md or the comment.

### MINOR-7: `server.ts:1606` violations URI parses filePath with `"/" + request.params.uri.replace(...)` — this unix-escapes the uri but is broken on Windows.

```ts
const filePath = "/" + request.params.uri.replace(resourceUri("violations/"), "");
```

On Windows, drive letters get prefixed with `/` and path resolution fails. Use `fileURLToPath` or branch on platform. Also: no sandbox — any absolute path the client sends is read. Should be confined to `projectRoot`.

### MINOR-8: `loadYamlConfig` catches errors with `console.error` but returns null without telemetry

A corrupt `flint.config.yaml` produces a console warning and silently falls back to `.flint/policy.json` (legacy). Operators cannot tell that their YAML failed to load. Emit a structured event.

### MINOR-9: `policyEngine.coerceToResolved` accepts `rawMode` without validating against `VALID_POLICY_MODES`

Line 307: `const rawMode = (raw.mithril?.mode as PolicyMode | undefined) ?? def.mithril.mode`. No `VALID_POLICY_MODES.has()` check. If raw.mithril.mode = `"bogus"`, it gets typed-cast-accepted and flows into the resolved policy. `validatePolicy` catches this earlier, but `coerceToResolved` is also reachable from `loadPolicy` directly where validation is not run.

### MINOR-10: `errorTaxonomy.ts` has no entries for `SYNC-001`, `SYNC-002` (SYNC violation types referenced in CLAUDE.md and elsewhere)

Sync violation ruleIds are emitted by the sync engine but there is no taxonomy entry. Users hitting a SYNC-001 get no recovery guidance.

### MINOR-11: `DEFAULT_RESOLVED_POLICY.a11y.disabled_rules: []` is set but never consumed

The `disabled_rules` field is deprecated (comment at line 58 says so). But `coerceToResolved` still copies it into the resolved output (line 433). Remove it from the resolved shape to prevent new consumers latching onto a deprecated field.

### MINOR-12: `server.ts` uses `process.cwd()` as `projectRoot` in `ReadResourceRequestSchema` (line 1353)

Every resource handler assumes `projectRoot === process.cwd()`. If the MCP server is launched from a different directory than the project being audited (e.g. VS Code on Windows, or CI), resources return wrong data without warning. Should call `resolveProjectRoot()` from `config-loader.ts`.

---

## Rule-ID Consistency Matrix

| RuleID | errorTaxonomy | KNOWN_MITHRIL_RULES | Linter visitor | Status |
|--------|:-:|:-:|:-:|--------|
| MITHRIL-COL | ✔ | ✔ | ✔ | OK |
| MITHRIL-TYP-001..005 | ✔ | ✔ | ✔ | OK |
| MITHRIL-SPC-001 | ✔ | ✔ | ✔ | OK |
| MITHRIL-SHD-001 | ✔ | ✔ | ✔ | OK |
| MITHRIL-OPC-001 | ✔ | ✔ | ✔ | OK |
| MITHRIL-IST-COL/TYP/SPC/SHD/OPC | ✔ | ✘ | ✔ | **DRIFT** |
| MITHRIL-DTO-001 | ✔ | ✘ | ✔ | **DRIFT** |
| MITHRIL-TW-001/002 | ✔ | ✘ | ✔ | **DRIFT** |
| MITHRIL-DARK-001 | ✔ | ✘ | ✔ | **DRIFT** |
| MITHRIL-REG-001 | ✔ | ✘ | ✔ | **DRIFT** |
| MITHRIL-COMP-001/002/003 | ✔ | ✔ | ✔ | OK |
| MITHRIL-FLUID-001 | ✔ | ✔ | ✔ | OK |
| HYDRATION-001 | ✔ | ✔ | ✔ | OK |
| MOTION-001 | ✔ | ✔ | ✔ | OK |
| VISUAL-REG-001 | ✔ | ✔ | ✔ | OK |
| MITHRIL-TYP-HIERARCHY | ✘ | ✔ | ? | **DRIFT** (in policy but no taxonomy) |
| MITHRIL-SPC-TOUCH | ✘ | ✔ | ✔ | **DRIFT** (in policy but no taxonomy) |
| A11Y-001..010 | ✔ | ✔ | ✔ | OK |
| A11Y-011..017, 020..022, 030..103 | ✔ | ✘ | ✔ | **DRIFT — 50+ rules** |
| SYNC-001, SYNC-002 | ✘ | n/a | ✔ | **GAP** |
| SES-001..004, REG-001 | ✔ | n/a | service | OK |

---

## Recommended Action Order

1. **CRIT-1 + CRIT-3** — Unify policy loading. Delete `policyLoader.ts`, route `server.ts` through `policyEngine.resolvePolicy`, wire `flint_set_policy` through `validatePolicy`. Single biggest correctness win.
2. **CRIT-2** — Derive `KNOWN_*_RULES` from `errorTaxonomy` so there is one source of truth. Prevents silent validator regressions.
3. **MAJOR-6 + MAJOR-1** — Harden `flint_set_policy` and `configValidator` to cover `export_gate`, `environments`, `trust.profiles`.
4. **MAJOR-3 + MINOR-7** — Path-sandbox `resolveExtendsRef` and the violations resource URI.
5. **MAJOR-5** — Add runtime validation to `CallToolRequestSchema` handler. Zod pass at each case top.
6. **MAJOR-8** — Clean up `SEVERITY_RANK`. Remove `advisory` alias collision.
7. **MINOR-3** — Memoize `getErrorEntryByRuleId`. Cheap fix.
8. **MINOR-10** — Add SYNC-001/002 taxonomy entries.
9. **MINOR-5** — Refactor `CallToolRequestSchema` mega-switch into per-tool handlers. This is a multi-session effort but unblocks every future review.

---

## Grades

| File | Grade | Rationale |
|------|-------|-----------|
| `policyEngine.ts` | **D** | The code is well-structured, well-documented, and well-tested. It is also not used in production. Orphaned correctness is a bug. Grade reflects wiring status, not code quality. Wire it up and this becomes an A. |
| `errorTaxonomy.ts` | **A-** | 76 complete, authoritative, plain-language entries. Minor: O(n) lookup, missing SYNC entries, severity field ambiguity. |
| `server.ts` | **B** | Complete and functional registration surface. Loses points for: dead-code paths to `policyEngine`, no runtime input validation, mega-switch architecture, `process.cwd()` assumption, no path sandboxing on file-based resources. |
| `configValidator.ts` | **B+** | Clean, pure, collects all errors. Loses points for partial coverage — `export_gate`, `environments`, `trust.profiles`, `enforcement` all unvalidated. |
| `config-loader.ts` | **B-** | Correct on the happy path. Loses points for: silent validation warnings, missing path sandboxing on extends, shallow trust-section merge, no realpath canonicalization, and participating in the dual-loader problem (CRIT-3). |

**Aggregate review grade: B−.** The individual modules are each solid on their own axis, but the system-level wiring leaves the most valuable component (`policyEngine.ts` POL.1) disconnected from the runtime. Fixing CRIT-1 through CRIT-3 would move the aggregate to A−.
