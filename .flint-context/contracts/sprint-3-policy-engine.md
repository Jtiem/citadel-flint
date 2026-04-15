# Sprint 3 — Policy Engine Unification

**Phase:** Unified A+ Sweep Sprint 3
**Branch:** `fix/sprint-3-policy-engine`
**Status:** DRAFT (Phase 1 — awaiting Phase 1.5 contract lint)
**Owner:** flint-architect
**Spec:** `docs/strategy/Unified_A+_Sweep_Complete_Work_Queue.md` L127-152
**Review source:** `.flint-context/reviews/policy-mcp-aplus-review-2026-04-12.md`
**Executable contract:** `./sprint-3-policy-engine.contract.ts`

---

## Decisions Log

| Date | Decision | Decided by |
|------|----------|------------|
| 2026-04-12 | **Option A — full unification.** Delete `policyLoader.ts`, collapse all runtime policy reads through `policyEngine.resolvePolicy`. "One session, clean state forever." | Justin (user) |
| 2026-04-14 | Keep `loadConfig` working via `toLegacyFlintPolicy` adapter. Migrating `flintConfig` to `ResolvedPolicy` is explicitly Sprint 4 scope, not Sprint 3. | flint-architect |
| 2026-04-14 | `flint_set_policy` response shape changes from v1 `FlintPolicy` to v2 `ResolvedPolicy`. MCP response is internal; no external spec pinned. Documented as acceptable drift. | flint-architect |
| 2026-04-14 | Sprint is strictly sequential, not parallel. One agent, one chain of commits. | flint-architect |

---

## Scope Summary

**3 CRITICALs, 5 MAJORs, 3 MINORs across 5 source files + 1 test file.**

| File | Action | Defects |
|------|--------|---------|
| `flint-mcp/src/core/policyLoader.ts` | **DELETE** | CRIT-1 + CRIT-3 |
| `flint-mcp/src/core/policyEngine.ts` | MODIFY | CRIT-2, MAJOR-8, MINOR-9, MINOR-11 + new unified loader surface |
| `flint-mcp/src/core/config-loader.ts` | MODIFY | MAJOR-2, MAJOR-3, MAJOR-4, MINOR-2, MINOR-8 |
| `flint-mcp/src/core/configValidator.ts` | MODIFY | MAJOR-1 |
| `flint-mcp/src/core/errorTaxonomy.ts` | MODIFY | MINOR-3, MINOR-10 |
| `flint-mcp/src/server.ts` | MODIFY | Caller redirect for `flint_set_policy`, MAJOR-6 |
| `flint-mcp/src/__tests__/policy-engine.test.ts` | MODIFY | Imports + assertions retargeted to new surface |

---

## Per-File Defect Sections

### 1. `flint-mcp/src/core/policyLoader.ts` — DELETE

**Review (CRIT-3 L62-71):**
> Three functions named `loadPolicy` exist in the codebase: `policyEngine.loadPolicy`, `config-loader.loadPolicy`, `policyLoader.readPolicy`. They read the same `.flint/policy.json` file but return different shapes with different semantics. The v2 migration in `policyEngine.migrateV1ToV2` is bypassed whenever config-loader is the entry point (which is always, at runtime). Two code paths silently diverge on startup. **Fix: Delete `policyLoader.ts` entirely.**

**Action:** File removed. Its four exports — `readPolicy`, `writePolicy`, `mergePolicy`, `getDefaultPolicy` — are replaced by new exports on `policyEngine.ts` (see §2).

---

### 2. `flint-mcp/src/core/policyEngine.ts` — MODIFY (biggest change)

**CRIT-2: KNOWN_*_RULES derived from errorTaxonomy (L39-61 of review)**

> `KNOWN_MITHRIL_RULES` is missing `MITHRIL-IST-COL/TYP/SPC/SHD/OPC`, `MITHRIL-DTO-001`, `MITHRIL-TW-001/002`, `MITHRIL-DARK-001`, `MITHRIL-REG-001`. `KNOWN_A11Y_RULES` lists only `A11Y-001..010`. The taxonomy and Warden ship 50+ more. Any valid policy that sets a per-rule mode on e.g. `A11Y-011` is rejected by `validatePolicy` as "unknown rule ID."

**Fix (exact):**
```ts
import { REGISTRY } from './errorTaxonomy.js'
const KNOWN_MITHRIL_RULES: ReadonlySet<string> = new Set(
  Object.values(REGISTRY)
    .filter(e => e.category === 'mithril')
    .map(e => e.ruleId),
)
const KNOWN_A11Y_RULES: ReadonlySet<string> = new Set(
  Object.values(REGISTRY)
    .filter(e => e.category === 'accessibility')
    .map(e => e.ruleId),
)
```
Delete the hardcoded `MITHRIL_RULES: string[]` and `A11Y_RULES: string[]` literals at L185-215.

**MAJOR-8: SEVERITY_RANK cleanup (L158-179)**

> Reusing `'advisory'` as both a `PolicyMode` and a severity label is a category error. The mode name should never appear in a severity map.

**Fix:** Remove the `advisory: 2` line from `SEVERITY_RANK` at policyEngine.ts:628-646. Closed severity union: `info | warning | amber | critical`.

**MINOR-9: Validate rawMode in coerceToResolved (L218-220)**

> Line 307: `const rawMode = (raw.mithril?.mode as PolicyMode | undefined) ?? def.mithril.mode`. No `VALID_POLICY_MODES.has()` check.

**Fix:** At `coerceToResolved` (policyEngine.ts:303), wrap `rawMode` in `VALID_POLICY_MODES.has(rawMode) ? rawMode : def.mithril.mode` with a `console.warn` on fallback.

**MINOR-11: Remove deprecated `disabled_rules` from resolved shape (L226-228)**

> `DEFAULT_RESOLVED_POLICY.a11y.disabled_rules: []` is deprecated. Remove it from the resolved shape to prevent new consumers latching onto a deprecated field.

**Fix:** Delete `disabled_rules` from `ResolvedPolicy['a11y']` type, `DEFAULT_RESOLVED_POLICY`, and the copy in `coerceToResolved` (L433).

**New unified loader surface (CRIT-1, CRIT-3):**

Add these exports — see `.contract.ts` for exact type signatures:

| New export | Purpose |
|------------|---------|
| `loadAndResolvePolicy(projectRoot, { teamId?, strict? })` | The sole runtime loader. Replaces `readPolicy`. Returns `ResolvedPolicy`. |
| `writeResolvedPolicy(projectRoot, policy)` | Atomic write of `.flint/policy.json`. Replaces `writePolicy`. Accepts v2 shape. |
| `mergeAndValidatePolicy(projectRoot, partial)` | Read → deep-merge → `validatePolicy` → write. Replaces `mergePolicy`. Returns `{ ok: true, policy } \| { ok: false, errors }`. **MAJOR-6 fix.** |
| `getDefaultResolvedPolicy()` | Fresh clone of `DEFAULT_RESOLVED_POLICY`. Replaces `getDefaultPolicy`. |
| `toLegacyFlintPolicy(resolved)` | Adapter: `ResolvedPolicy → FlintPolicy` for the `flintConfig = loadConfig()` bridge. Marked `@deprecated Sprint 4`. |

---

### 3. `flint-mcp/src/core/config-loader.ts` — MODIFY

**MAJOR-2: Strict mode (L90-105 of review)**

> `const config = parsed as FlintProjectConfig`. Validation runs, warnings logged, but config is returned regardless. A `delta_e_critical <= delta_e` YAML is happily used.

**Fix:** Extend `loadYamlConfig` and `loadConfig` to accept `ConfigLoaderOptions { strict?: boolean }`. When `strict === true` and `validateProjectConfig` returns errors, throw a typed `ConfigValidationError`. Default `strict === false` for backward compat. `flint-ci` will opt in.

**MAJOR-3: Path sandbox on resolveExtendsRef (L108-121)**

> `extends: ['../../../../etc/passwd']` resolves to an arbitrary absolute path, then `loadYamlFile` happily `readFileSync`s it.

**Fix:** In `resolveExtendsRef` (config-loader.ts:343-359):
1. Relative refs → `path.resolve(projectRoot, ref)` then check `resolved.startsWith(projectRoot + path.sep)`. If not, throw `ConfigPathSandboxError`.
2. Absolute refs → only allow if they resolve inside `PRESETS_DIR`. Otherwise throw.
3. After resolution, `fs.realpathSync(resolved)` for canonicalization (also satisfies MAJOR-4).

**MAJOR-4: realpathSync canonicalization (L125-132)**

> A circular `extends` chain where the same file is referenced with two different ref strings (`./a.yaml` vs `../dir/a.yaml`) can be loaded twice.

**Fix:** In `resolveExtends`, run `fs.realpathSync(resolvedPath)` before adding to the `seen` set.

**MINOR-2: Deep-merge trust.profiles (L188-190)**

> Lines 208-218: override wins completely — no per-profile merge. A child config that defines a single profile nukes the parent's entire profile list.

**Fix:** In `deepMergeConfigs`, merge `trust.profiles` by `id`: each override profile replaces the base entry with matching `id`, other base entries are preserved. Same treatment for `trust.approval` and `trust.escalation` arrays where a key is present.

**MINOR-8: Structured config event on YAML failure (L215-217)**

> A corrupt `flint.config.yaml` produces a `console.warn` and silently falls back. Operators cannot tell.

**Fix:** When `loadYamlConfig` catches a YAML parse error, emit a structured event via existing governance event bus (or append to `.flint/ledger/config-events.jsonl` if no bus exists in MCP today — check during impl). Keep the `console.error` for dev ergonomics but no longer silent at the data layer.

---

### 4. `flint-mcp/src/core/configValidator.ts` — MODIFY

**MAJOR-1 (L77-88 of review):**

> `validateProjectConfig` does not validate: `rules.export_gate`, `rules.baseline.enabled`, `environments.<env>.*` (recursively), `trust.profiles`, `trust.approval`, `trust.escalation`, `enforcement`.

**Fix — add validation cases for:**
- `rules.export_gate.block_on_overrides` must be boolean
- `rules.export_gate.block_on_mithril` must be boolean
- `rules.export_gate.block_on_a11y` must be boolean
- `rules.baseline.enabled` must be boolean when present
- `environments` — recurse into each env value, reuse `validateProjectConfig` on the overlay shape, prefix errors with `environments.<name>.`
- `trust.profiles[]` — each entry must have `id: string`, `tier: 'trusted' | 'verified' | 'sandboxed' | 'quarantined'`
- `trust.approval` — if present, validate shape
- `trust.escalation` — if present, validate shape
- `enforcement.mode` — if present, must be one of the valid enforcement modes

Every new section gets at least one targeted test in `configValidator.test.ts` with a known-bad input.

---

### 5. `flint-mcp/src/core/errorTaxonomy.ts` — MODIFY

**MINOR-3: BY_RULE_ID reverse index (L193-194)**

> Line 1451: iterates `Object.values(REGISTRY)` on every call. The linter hot loop calls this per warning.

**Fix:**
```ts
const BY_RULE_ID: Readonly<Record<string, ErrorEntry>> = Object.freeze(
  Object.fromEntries(
    Object.values(REGISTRY).map(e => [e.ruleId, e]),
  ),
)
export function getErrorEntryByRuleId(ruleId: string): ErrorEntry | undefined {
  return BY_RULE_ID[ruleId]
}
```

**This is a CRIT-2 dependency** — `policyEngine.ts` KNOWN_*_RULES derivation depends on the REGISTRY being importable with a stable shape.

**MINOR-10: SYNC-001 / SYNC-002 entries (L222-224)**

> Sync violation ruleIds are emitted by the sync engine but there is no taxonomy entry. Users hitting a SYNC-001 get no recovery guidance.

**Fix:** Add two entries to `REGISTRY`:
- `SYNC-001` — token drift (`category: 'sync'`, `severity: 'warning'`, plain-language explanation + remediation)
- `SYNC-002` — orphaned token (`category: 'sync'`, `severity: 'warning'`)

Reference: CLAUDE.md "SYNC Violation Types (SYNC-001 token drift, SYNC-002 orphaned token) | SYNC.3 | ONLINE" for context strings.

---

### 6. `flint-mcp/src/server.ts` — MODIFY (caller redirect)

See **Caller Redirect Table** below.

---

## Caller Redirect Table

Grep confirmed the caller surface is **exactly 2 files** (small blast radius — this sprint is safer than it looks).

| # | File | Line | Old import | Old call | New import | New call |
|---|------|------|-----------|----------|-----------|----------|
| 1 | `flint-mcp/src/server.ts` | 30 | `import { readPolicy, writePolicy, mergePolicy, getDefaultPolicy } from "./core/policyLoader.js"` | — | `import { loadAndResolvePolicy, writeResolvedPolicy, mergeAndValidatePolicy, getDefaultResolvedPolicy } from "./core/policyEngine.js"` | — |
| 2 | `flint-mcp/src/server.ts` | 1436 | `readPolicy` | `const policy = readPolicy(projectRoot);` | `loadAndResolvePolicy` | `const policy = loadAndResolvePolicy(projectRoot);` |
| 3 | `flint-mcp/src/server.ts` | 2796 | `readPolicy` | `const current = readPolicy(projectRoot);` (flint_set_policy read branch) | `loadAndResolvePolicy` | `const current = loadAndResolvePolicy(projectRoot);` — response now stringifies `ResolvedPolicy` (v2) |
| 4 | `flint-mcp/src/server.ts` | 2809 | `mergePolicy` | `const merged = mergePolicy(projectRoot, policyUpdate);` | `mergeAndValidatePolicy` | `const result = mergeAndValidatePolicy(projectRoot, policyUpdate); if (!result.ok) { return toolError("flint_set_policy", new Error("validation failed"), HINTS.validationErrors(result.errors)); } const merged = result.policy;` — **MAJOR-6 fix** |
| 5 | `flint-mcp/src/server.ts` | 2864 | `getDefaultPolicy` | `const defaults = getDefaultPolicy();` | `getDefaultResolvedPolicy` | `const defaults = getDefaultResolvedPolicy();` |
| 6 | `flint-mcp/src/server.ts` | 2865 | `writePolicy` | `writePolicy(projectRoot, defaults);` | `writeResolvedPolicy` | `writeResolvedPolicy(projectRoot, defaults);` |
| 7 | `flint-mcp/src/__tests__/policy-engine.test.ts` | 32 | `import { readPolicy, writePolicy, mergePolicy, getDefaultPolicy } from '../core/policyLoader.js'` | — | `import { loadAndResolvePolicy, writeResolvedPolicy, mergeAndValidatePolicy, getDefaultResolvedPolicy } from '../core/policyEngine.js'` | Rewrite test assertions for ResolvedPolicy shape |

**False positives filtered out** (NOT callers — do not touch):
- `flint-mcp/src/tools/setLibrary.ts` defines its own local `readPolicy`/`writePolicy` helpers (lines 214, 224) that operate on a `Record<string, unknown>` manifest — unrelated to policy.json.
- `flint-mcp/src/core/packImportService.ts:622,1354` defines its own local `mergePolicy` for pack import merging — unrelated.
- `flint-mcp/src/tools/__tests__/migrateConfig.test.ts`, `codeConnectSync.test.ts`, `sentinel.test.ts`, `dbom/__tests__/dbom.test.ts`, `governance/__tests__/dbomService.test.ts` all define local `writePolicy(tmpDir, ...)` test helpers that write JSON fixtures directly — unrelated to the module being deleted.

**Total: 6 call-site edits in 1 production file + 1 test file rewrite.**

---

## Work Partition Table

| Task | Owner | Depends on |
|------|-------|-----------|
| errorTaxonomy BY_RULE_ID index + SYNC-001/002 entries | `coder` | — |
| policyEngine: derive KNOWN_*_RULES from REGISTRY | `coder` | errorTaxonomy BY_RULE_ID |
| policyEngine: MAJOR-8 / MINOR-9 / MINOR-11 cleanups | `coder` | — |
| policyEngine: new unified loader surface (loadAndResolvePolicy, writeResolvedPolicy, mergeAndValidatePolicy, getDefaultResolvedPolicy, toLegacyFlintPolicy) | `coder` | MAJOR-8/MINOR-11 done |
| config-loader: `ConfigLoaderOptions`, strict mode | `coder` | — |
| config-loader: path sandbox + realpathSync | `coder` | — |
| config-loader: trust.profiles deep-merge | `coder` | — |
| config-loader: structured config-validation event | `coder` | — |
| configValidator: export_gate, environments (recursive), trust.profiles, enforcement coverage | `coder` | — |
| server.ts caller redirect (6 edits) | `coder` | policyEngine unified surface ready |
| policy-engine.test.ts rewrite against new surface | `flint-test-writer` | policyEngine unified surface ready |
| Config-loader test additions (strict, sandbox, realpath, deep-merge) | `flint-test-writer` | config-loader changes landed |
| configValidator test additions | `flint-test-writer` | configValidator changes landed |
| errorTaxonomy test for BY_RULE_ID + SYNC entries | `flint-test-writer` | errorTaxonomy changes landed |
| DELETE policyLoader.ts | `coder` | ALL redirects landed + test suite green |
| Full test suite + `npx tsc --noEmit` | `coder` | everything above |

**No `flint-ast-surgeon` needed** — the caller redirect is pure import/call-site substitution, no Babel AST traversal required.

---

## Implementation Order (Strict Sequence — NOT parallel)

User explicitly chose option A "one session, clean state." Phase 2 is a single chain:

1. **errorTaxonomy.ts** — Add `BY_RULE_ID` reverse index. Add `SYNC-001` and `SYNC-002` entries. This must land first because policyEngine CRIT-2 imports from it.
2. **policyEngine.ts (part 1 — cleanups)** — Fix `SEVERITY_RANK` (MAJOR-8), validate `rawMode` in `coerceToResolved` (MINOR-9), drop `disabled_rules` from resolved shape (MINOR-11).
3. **policyEngine.ts (part 2 — CRIT-2)** — Replace hardcoded `KNOWN_MITHRIL_RULES` / `KNOWN_A11Y_RULES` with derivation from `REGISTRY`.
4. **policyEngine.ts (part 3 — unified loader surface)** — Add `loadAndResolvePolicy`, `writeResolvedPolicy`, `mergeAndValidatePolicy`, `getDefaultResolvedPolicy`, `toLegacyFlintPolicy`. Existing `resolvePolicy` / `validatePolicy` stay unchanged; the new APIs wrap them.
5. **config-loader.ts** — Add `ConfigLoaderOptions`, strict mode, path sandbox (`ConfigPathSandboxError`), `realpathSync` canonicalization, `trust.profiles` deep-merge, structured config-validation event emission.
6. **configValidator.ts** — Extend `validateProjectConfig` to cover `export_gate`, `environments` (recursive), `trust.profiles`, `trust.approval`, `trust.escalation`, `enforcement`.
7. **server.ts caller redirect** — Update import (line 30) + 5 call sites (1436, 2796, 2809, 2864, 2865). Wire `mergeAndValidatePolicy` error branch into the `flint_set_policy` update response.
8. **policy-engine.test.ts** — Rewrite imports and assertions against new `ResolvedPolicy`-returning surface.
9. **DELETE `flint-mcp/src/core/policyLoader.ts`** — Only after step 8 passes. No earlier.
10. **Full verification** — `cd flint-mcp && npm test`, `npm run test:react`, `npm test`, `npx tsc --noEmit`. Report in required format.

**Why this order is non-negotiable:**
- Step 3 depends on step 1 (REGISTRY must have the reverse index).
- Step 7 depends on step 4 (new exports must exist before callers switch).
- Step 9 depends on step 7 + step 8 (deleting before the redirect lands breaks compilation; deleting before the test rewrite breaks tests).

---

## Commandment Checklist

| # | Commandment | Applies? | How the design satisfies it |
|---|-------------|----------|-----------------------------|
| 6 | Gatekeeper Rule | YES | A correctly validated policy is the prerequisite for the export gate to block on the right modes. Fixing CRIT-1..3 and MAJOR-6 ensures the gate reads real per-rule modes. |
| 14 | Bypass Prohibition | YES | `config-loader` path sandbox (MAJOR-3) closes a filesystem traversal bypass where user YAML could drag arbitrary host files into the config merge. |
| 13 | Deterministic Surgery | N/A | No source-code mutation. All changes are direct TS edits to engine files. No Babel. |
| 12 | Atomic Queuing | PARTIAL | `writeResolvedPolicy` performs a direct `fs.writeFileSync` to `.flint/policy.json` (not source code, not routed through FileTransactionManager). Same policy as the deleted `policyLoader.writePolicy` — Commandment 12 scopes to source files per existing precedent. |

---

## Non-Goals (Explicit Out-of-Scope)

- **No new MCP tools.** Sprint 4 owns the server.ts registration layer.
- **No new IPC channels.** No Electron/preload changes.
- **No new Zustand stores.** Policy data does not enter Glass state.
- **No new Glass UI components.**
- **No refactor of `CallToolRequestSchema` mega-switch** (MINOR-5 — separate multi-session effort).
- **No Zod runtime validation on tool args** (MAJOR-5 — Sprint 4).
- **No refactor of `flintConfig` type to `ResolvedPolicy`** (Sprint 4). Preserved via `toLegacyFlintPolicy` adapter.
- **No violations URI path sandbox** (MINOR-7 — Sprint 4).
- **No refactor of resources to use `resolveProjectRoot`** (MINOR-12 — Sprint 4).

---

## Risks

| ID | Severity | Description | Mitigation |
|----|----------|-------------|-----------|
| `shape-drift` | HIGH | `flint_set_policy` read/update response currently stringifies v1 `FlintPolicy`. Redirect changes it to v2 `ResolvedPolicy`. | MCP tool response is internal; no external spec pinned to v1. Document the shape change in HANDOFF.md. Consumers re-read with `loadAndResolvePolicy`, which returns the same shape. |
| `flintConfig-reload` | MEDIUM | `server.ts:2811` reloads `flintConfig = loadConfig(projectRoot)` after every policy update. `loadConfig` uses `config-loader.loadPolicy` (v1). If we accidentally change `loadConfig` in this sprint we break audit thresholds. | Sprint 3 does NOT touch `loadConfig`'s return type. `loadPolicy` (v1 inside config-loader) stays as the internal adapter. Sprint 4 migrates `flintConfig` to `ResolvedPolicy`. |
| `test-import-cascade` | LOW | `policy-engine.test.ts` imports from `policyLoader.ts`. Must be rewritten before the file is deleted. | Order enforced in step 8 vs step 9. TSC catches it if reversed. |
| `validation-too-strict` | MEDIUM | Adding `mergeAndValidatePolicy` could reject existing user policies that previously wrote successfully with bad fields. | Validation errors are returned in the response, not thrown. Caller chooses whether to retry. Add a one-line migration note to HANDOFF.md. |
| `structured-event-bus-missing` | LOW | MINOR-8 requires a structured event for YAML parse failures. If MCP has no event bus, the implementer will need to append to a JSONL file. | Impl agent checks during step 5. If no bus exists, append to `.flint/ledger/config-events.jsonl` and document. |

---

## Risk Callouts Needing User Decision

Three items from your brief that require a call before Phase 1.5 lint:

1. **Glass IPC consumers of deleted `getPolicy()`:** Grep confirms **no Glass / `src/` / `electron/` code imports from `flint-mcp/src/core/policyLoader.ts`.** The module is MCP-internal. No migration path needed on the Glass side. `flint://policy` MCP resource reads through a separate path in `server.ts` and will be upgraded as part of the CRIT-1 redirect. **No user decision needed — proceeding as scoped.**

2. **Does `flint_set_policy` read through policyLoader today?** **Yes — all three branches (read/update/reset) at server.ts:2796/2809/2864/2865.** Sprint 3 redirects them to the new `policyEngine` surface (see table rows #3-6). The MCP response shape for `flint_set_policy` changes from v1 `FlintPolicy` to v2 `ResolvedPolicy`. Sprint 4 will NOT need to touch this handler again for the policyLoader issue. **Decision needed: confirm the response-shape change is acceptable.** My recommendation: YES — no external consumer pinned to v1; ResolvedPolicy is strictly richer.

3. **Is `config-loader.ts` synchronous?** **Yes, fully synchronous today** (`fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`). Adding `strict: boolean` does NOT change the signature from sync to async — strict mode throws synchronously, which matches existing error behavior. `fs.realpathSync` is also synchronous. **No ripple into callers. No user decision needed.**

---

## Phase 2 Entry Criteria (must be green before coding starts)

- [ ] Phase 1.5 contract lint: APPROVED
- [ ] `.contract.ts` compiles with `npx tsc --noEmit --project flint-mcp/tsconfig.json` (types in it reference existing policyEngine exports; should pass)
- [ ] User confirmed risk callout #2 (response shape change acceptable)
- [ ] Territory claim: `flint-mcp/src/core/*.ts` + `flint-mcp/src/server.ts` + `flint-mcp/src/__tests__/policy-engine.test.ts` claimed in `.flint-context/ACTIVE-SWARM-TERRITORY.md`

## Phase 2 Exit Criteria (must be green to hand to Phase 3)

- [ ] `policyLoader.ts` deleted
- [ ] `flint-mcp/` test suite green with new tests from `testBoundaries`
- [ ] `npx tsc --noEmit` clean across the whole repo (server.ts + flint-mcp + glass)
- [ ] `npm run test:react` + `npm test` still green (no unintended ripple)
- [ ] Test result report in standard format posted to HANDOFF.md
