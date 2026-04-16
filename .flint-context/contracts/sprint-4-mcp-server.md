# Sprint 4 — MCP Server + Registrations

**Phase:** SWEEP-S4
**Owner:** flint-architect
**Date:** 2026-04-15
**Status:** APPROVED
**Spec:** `docs/strategy/Unified_A+_Sweep_Complete_Work_Queue.md` lines 155-170
**Source review:** `.flint-context/reviews/policy-mcp-aplus-review-2026-04-12.md`
**Branch:** `fix/sprint-4-mcp-server`

---

## 0. Decisions Log (Pre-Phase-2 Approvals)

| # | Decision | Rationale | Needs user call? |
|---|----------|-----------|------------------|
| D1 | **Zod validation = central registry pattern.** Create `flint-mcp/src/tools/schemas.ts` exporting `TOOL_INPUT_SCHEMAS: Record<string, z.ZodTypeAny>` keyed by tool name. A single helper `validateToolInput(toolName, args)` runs at the very top of the `CallToolRequestSchema` callback (before the switch). Unknown tools fall through to per-case casts (legacy). | One call site to maintain, one place to add new tools, zero per-case duplication. Mirrors `shared/ipc-validators.ts` pattern. Generic dispatch keeps the mega-switch shorter than per-case `parse()` calls. | **No** |
| D2 | **Handler extraction Sprint 4 scope: 5 cases.** `flint_audit` (~87 LOC), `flint_fix` (~96 LOC), `flint_migrate_tw` (~110 LOC), `flint_agent_trust` (~82 LOC), `flint_set_policy` (~104 LOC). Extract to `flint-mcp/src/tools/handlers/<tool>.handler.ts` with signature `(args, ctx) => CallToolResult`. Remaining ~50 cases carry forward to a future sprint. | These are the 5 longest cases by raw body size, all with internal switch/branching. They block code review the most. Other long cases (`flint_ast_mutate` ~390 LOC, `flint_query_registry` ~70 LOC) deferred — `flint_ast_mutate` is too risky to touch the same sprint as policy migration. | **No** |
| D3 | **Full `flintConfig` → `ResolvedPolicy` consumer migration (option B, APPROVED 2026-04-15).** Rewrite all 13 consumer read sites in `server.ts` (lines 1904, 1905, 1908, 1911, 2544, 2553, 2554, 2556, 2565, 2577, 2627, 2657, 4268) from the legacy v1 `FlintPolicy` shape to the `ResolvedPolicy` surface resolved via `policyEngine.resolvePolicy(projectRoot)`. The lossy site at line 2553 (`disabled_rules`) is replaced by filtering `resolvedPolicy.a11y.rules` entries where `mode === 'off'`. Once every consumer is migrated, **remove `toLegacyFlintPolicy` adapter entirely** and drop the legacy `FlintConfig.policy` field. | Closes the loop on Commandment 6 (Gatekeeper) for Sprint 3's engine work: per-rule modes (blocking/normative/advisory/off) now reach the export gate. Option A (adapter-only) leaves the gate silently on v1 thresholds; option B (full migration) was approved because the 13 sites are contained to `server.ts` and grep confirms zero external consumers of `toLegacyFlintPolicy`. | **APPROVED** (user, 2026-04-15) |
| D4 | **Accept reduced rule-pack scope (APPROVED 2026-04-15).** Sprint 3 already registered the 5 rule pack tools at `server.ts:4018-4058`. Sprint 4 work: add Zod input schemas via the D1 registry, add regression tests, update `CLAUDE.md` to remove the "5 rule pack tools defined but not registered" note. No handler registration work remains. | The spec was authored before Sprint 3 closed. Verified via read of server.ts:4018-4058. | **APPROVED** (user, 2026-04-15) |
| D5 | **Accept reduced `flint_set_policy` scope (APPROVED 2026-04-15).** Sprint 3 already wired `flint_set_policy` through `mergeAndValidatePolicy` at `server.ts:2817`. Sprint 4 work: add a regression test that an invalid update is rejected; fix the `process.cwd()` site at line 2798 (MINOR-12). No validation plumbing work remains. | Verified by reading server.ts. Sprint 3 review item is closed. | **APPROVED** (user, 2026-04-15) |
| RC3 | **Authorize MCP JSON-RPC test harness (APPROVED 2026-04-15).** `flint-test-writer` is authorized to add a ~30 LOC synthetic `CallToolRequest` harness at `flint-mcp/src/__tests__/harness.ts` reaching `(server as any)._requestHandlers` directly. Needed because the Zod validation hoist must be exercised at the request envelope layer, not just the handler body. | Risk row 5: no existing harness. Without this, the Zod validation regression tests cannot assert that malformed inputs are rejected before the mega-switch. | **APPROVED** (user, 2026-04-15) |
| D6 | **`flint://rules` enrichment is the largest unfinished item.** The current handler at line 1399 returns raw rule JSON keyed by domain. We will (a) load `ResolvedPolicy` once, (b) for each rule emit `{ ...rule, ruleMode, sourceAuthority, pack }` where `ruleMode` comes from `getRuleMode(ruleId, resolved)`, `sourceAuthority` from `errorTaxonomy.getErrorEntryByRuleId(ruleId)`, and `pack` from `rulePackRegistry.findPackForRule(ruleId)`. Add a top-level `packs` section listing enabled packs from the resolved policy. | Direct quote from spec MAJOR. Need rulePackRegistry to expose a `findPackForRule(ruleId)` helper if absent. | **No** — but flag if helper missing |
| D7 | **Windows URI fix uses platform-aware normalize, NOT `fileURLToPath`.** The `flint://violations/<path>` URI is not a `file://` URI so `fileURLToPath` is wrong. Fix: strip the `flint://violations/` prefix, `decodeURIComponent`, then on Windows replace leading `/C:/` patterns with `C:\` and `path.normalize`. Sandbox to `projectRoot` (reject paths outside). | The current `"/" + uri.replace(...)` is broken on both platforms — it prepends a slash to a Windows drive letter. | **No** |
| D8 | **`process.cwd()` replacement = call `resolveProjectRoot()` once at handler-callback entry.** Currently 6 sites in the call-tool handler grab `process.cwd()` independently. Centralize: hoist `const projectRoot = resolveProjectRoot()` to the top of the `CallToolRequestSchema` callback. Replace each `process.cwd()` with `projectRoot`. The `ReadResourceRequestSchema` handler at line 1359 also needs the same hoist. | Single-line change per site. `resolveProjectRoot()` already exists in config-loader.ts. | **No** |

---

## 1. Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `flint-mcp/src/tools/schemas.ts` | CREATE | coder | Central Zod schema registry for all 59 tools (D1) |
| `flint-mcp/src/tools/handlers/audit.handler.ts` | CREATE | coder | Extract `flint_audit` case body (D2) |
| `flint-mcp/src/tools/handlers/fix.handler.ts` | CREATE | coder | Extract `flint_fix` case body (D2) |
| `flint-mcp/src/tools/handlers/migrateTw.handler.ts` | CREATE | coder | Extract `flint_migrate_tw` case body (D2) |
| `flint-mcp/src/tools/handlers/agentTrust.handler.ts` | CREATE | coder | Extract `flint_agent_trust` case body (D2) |
| `flint-mcp/src/tools/handlers/setPolicy.handler.ts` | CREATE | coder | Extract `flint_set_policy` case body, fix `process.cwd()` (D2, D5, D8) |
| `flint-mcp/src/server.ts` | MODIFY | coder | Wire validation; hoist projectRoot; thin out 5 cases; rules resource enrichment; violations URI fix; **full migration of 13 `flintConfig.policy.*` reads to `resolvedPolicy` (D3)** |
| `flint-mcp/src/core/policyEngine.ts` | MODIFY | coder | **DELETE `toLegacyFlintPolicy` export (D3)** — no external consumers remain; update `flint-mcp/src/__tests__/policy-engine.test.ts` to drop the adapter describe block |
| `flint-mcp/src/core/rulePackRegistry.ts` | MODIFY | flint-mcp-specialist | Add `findPackForRule(ruleId): RulePackEntry | null` if absent (D6 dependency) |
| `flint-mcp/src/__tests__/harness.ts` | CREATE | flint-test-writer | MCP JSON-RPC synthetic `CallToolRequest` harness (~30 LOC; reaches `server._requestHandlers`) — authorizes RC3 |
| `flint-mcp/src/__tests__/server.zod-validation.test.ts` | CREATE | flint-test-writer | Per-tool Zod schema rejection tests (missing field, wrong type, enum violation) — uses harness |
| `flint-mcp/src/__tests__/server.rules-resource.test.ts` | CREATE | flint-test-writer | `flint://rules` returns enriched ruleMode/sourceAuthority/pack for known rule |
| `flint-mcp/src/__tests__/server.violations-uri.test.ts` | CREATE | flint-test-writer | URI parsing on POSIX, Windows-style drive letters, sandbox rejection |
| `flint-mcp/src/__tests__/server.handler-extraction.test.ts` | CREATE | flint-test-writer | Round-trip MCP JSON-RPC for each of the 5 extracted handlers (smoke + happy path) |
| `flint-mcp/src/__tests__/server.flintconfig-resolved.test.ts` | CREATE | flint-test-writer | `runServer` populates `flintConfig.policy` from ResolvedPolicy adapter view |
| `flint-mcp/src/tools/__tests__/rulePacks.zod.test.ts` | CREATE | flint-test-writer | Rule pack tool input Zod schemas reject malformed inputs |
| `CLAUDE.md` | MODIFY | coder | Remove the "5 rule pack tools defined but not registered" note (D4) |

---

## 2. Per-Concern Specification

### 2.1 Zod runtime validation (MAJOR-5)

**Defect:** No runtime validation of tool inputs; cast assertions only. Bad inputs hit `TypeError` deep in handlers.

**Change:**
1. Create `flint-mcp/src/tools/schemas.ts`. Export:
   ```ts
   export const TOOL_INPUT_SCHEMAS: Record<string, z.ZodTypeAny>
   export function validateToolInput(toolName: string, args: unknown):
     | { ok: true; args: unknown }
     | { ok: false; error: string }
   ```
2. Populate schemas for all 59 registered tools. Where existing `inputSchema` JSON exists on the tool definition, mirror it field-for-field. Required fields use `.refine` for cross-field constraints.
3. In `server.ts` `CallToolRequestSchema` callback, hoist:
   ```ts
   const validated = validateToolInput(request.params.name, request.params.arguments);
   if (!validated.ok) return toolError(request.params.name, new Error(validated.error), HINTS.missingParam(...));
   const args = validated.args;
   ```
4. Delete in-case manual presence checks where the schema now covers them (e.g., the `if (!auditArgs.filePaths?.length && ...)` block at flint_audit can be replaced).

**Acceptance:**
- `server.zod-validation.test.ts` posts `{name: "flint_audit", arguments: {}}` and asserts a structured error response (not a thrown TypeError).
- For each of 5 sample tools (`flint_audit`, `flint_fix`, `flint_set_policy`, `flint_agent_trust`, `flint_set_rule_mode`): one missing-field, one wrong-type, one enum-violation test.
- `npx tsc --noEmit` clean.

**Dependencies:** None. Group A — runs in parallel with handler extraction prep.

---

### 2.2 `flint_set_policy` regression test (D5 — reduced scope)

**Defect:** Spec says wire through `policyEngine.validatePolicy`. **Already done** by Sprint 3 (line 2817 `mergeAndValidatePolicy`). Per D5, Sprint 4 scope is **regression test + `process.cwd()` fix only**.

**Change:**
1. Add regression test: post `{action: "update", policy: {mithril: {deltaE_threshold: -5}}}` → expect structured failure with the validator error array surfaced. Test uses the new `harness.ts`.
2. Replace the `process.cwd()` at line 2798 with the hoisted `projectRoot` (D8).

**Out of scope (D5):** Re-verifying `mergeAndValidatePolicy` internals; any change to `policyEngine.ts` validation plumbing.

**Acceptance:**
- New regression test in `server.set-policy.test.ts` (extends existing) for invalid update rejection.
- Existing tests still pass.

**Dependencies:** Serializes after handler extraction of `flint_set_policy` (Group B).

---

### 2.3 `flint://rules` enrichment (MAJOR-7)

**Defect:** Returns raw rule JSON; no `ruleMode`, `sourceAuthority`, `pack` fields. Hides the rule pack registry from the canonical discovery endpoint.

**Change:**
1. In `ReadResourceRequestSchema` handler at line 1399, after iterating `domainRegistry.list()` and loading rules:
   ```ts
   const resolved = resolvePolicy(projectRoot);
   const enrichedRules = allRules[domainId].map(rule => ({
     ...rule,
     ruleMode: getRuleMode(rule.id, resolved),       // 'blocking' | 'normative' | 'advisory' | 'off'
     sourceAuthority: getErrorEntryByRuleId(rule.id)?.sourceAuthority ?? null,
     pack: rulePackRegistry.findPackForRule(rule.id)?.id ?? null,
   }));
   ```
2. Add a top-level `packs: ResolvedPolicy['packs']` section to the response body listing enabled packs.
3. If `rulePackRegistry.findPackForRule` does not exist, `flint-mcp-specialist` adds it as a static `Map<ruleId, packId>` built once at module init.

**Acceptance:**
- `server.rules-resource.test.ts` reads `flint://rules` and asserts each rule has `ruleMode`, `sourceAuthority`, `pack` keys (some may be `null`).
- For a known rule (e.g., `MITHRIL-COL`), assert `ruleMode === 'blocking'` and `sourceAuthority` matches errorTaxonomy.

**Dependencies:** Requires `findPackForRule` helper. Group A (rulePackRegistry change parallelizes with schema registry).

---

### 2.4 Rule pack tool schemas + tests (D4 — reduced scope)

**Defect (claimed):** "598 LOC of dead handlers." **Actual:** Already registered at `server.ts:4018-4058`. Spec is stale. Per D4, Sprint 4 scope is **Zod schemas + tests + CLAUDE.md cleanup only**.

**Change:**
1. Add Zod schemas for the 5 tools (`flint_list_rule_packs`, `flint_enable_pack`, `flint_disable_pack`, `flint_set_rule_mode`, `flint_compliance_coverage`) to `tools/schemas.ts` (D1).
2. Add `tools/__tests__/rulePacks.zod.test.ts` with one rejection test per tool (missing required field + wrong-type + enum violation).
3. Update `CLAUDE.md` to delete the "Note: 5 rule pack tools ... not yet registered in `server.ts`" sentence.

**Out of scope (D4):** Handler registration, tool catalog updates, `FLINT_*_TOOL` export wiring — all already shipped by Sprint 3.

**Acceptance:**
- `npm test` for `rulePacks.zod.test.ts` passes.
- `CLAUDE.md` no longer contains the stale note.

**Dependencies:** Schema registry (Group A).

---

### 2.5 Per-tool handler extraction (MINOR-5)

**Defect:** ~2400 LOC mega-switch unmaintainable.

**Change:** Extract 5 cases to `flint-mcp/src/tools/handlers/<tool>.handler.ts`. Common signature:
```ts
import type { ResolvedToolContext } from './types.js';
export function handleAudit(args: AuditArgs, ctx: ResolvedToolContext): Promise<CallToolResult>;
```
where `ResolvedToolContext = { projectRoot: string; flintConfig: FlintConfig }`.

The 5 picks (from D2):
1. `flint_audit` (lines 2506-2592)
2. `flint_fix` (lines 2593-2688)
3. `flint_migrate_tw` (lines 3288-3397)
4. `flint_agent_trust` (lines 3398-3479)
5. `flint_set_policy` (lines 2792-2894)

After extraction, each case becomes 3-5 lines: validate → call handler → return.

**Acceptance:**
- `server.handler-extraction.test.ts`: per-handler unit tests calling the exported function directly with a mock ctx.
- Existing integration tests for these tools still pass unchanged.
- Each new handler file < 200 LOC.

**Dependencies:** Group B — must serialize against any other change to the same case bodies. Run AFTER schema registry (so handler signatures can rely on validated args).

---

### 2.6 Windows violations URI fix (MINOR-7)

**Defect:** `"/" + uri.replace(...)` breaks Windows paths and lacks sandboxing.

**Change:** Replace block at server.ts:1612-1626:
```ts
function parseViolationsUri(uri: string, projectRoot: string): string | null {
  const raw = decodeURIComponent(uri.replace(resourceUri('violations/'), ''));
  // Normalize: handle leading slash before Windows drive letter
  let candidate = process.platform === 'win32' && /^\/[A-Za-z]:/.test(raw)
    ? raw.slice(1)
    : raw;
  candidate = path.normalize(candidate);
  const absolute = path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
  // Sandbox: must live inside projectRoot
  const rel = path.relative(projectRoot, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return absolute;
}
```
Reject with structured error if `parseViolationsUri` returns null.

**Acceptance:**
- `server.violations-uri.test.ts`: POSIX path inside project → resolves; Windows-style `/C:/foo/bar.tsx` (with `process.platform` mocked or skipped on non-Windows) → resolves; `../../etc/passwd` → null/error.

**Dependencies:** None. Group A.

---

### 2.7 `process.cwd()` replacement (MINOR-12)

**Defect:** 6 sites in CallToolRequestSchema callback + 1 site in ReadResourceRequestSchema use `process.cwd()` independently.

**Change:**
- ReadResourceRequestSchema (line 1359): hoist `const projectRoot = resolveProjectRoot()`.
- CallToolRequestSchema callback: hoist `const projectRoot = resolveProjectRoot()` after the validation block.
- Replace each `process.cwd()` site (lines 1359, 1853, 2447, 2752, 2798, 2917, 3792, 3849, 3922) with `projectRoot`.
- Two dynamic sites that need their own resolution (`findProjectRoot(resolvedFixPath) ?? flintConfig.projectRoot`) at 2636/2657 stay as-is — they are file-relative.

**Acceptance:**
- `npx tsc --noEmit` clean.
- Existing tests pass (`resolveProjectRoot()` already returns CWD if no override).

**Dependencies:** Trivially serial against any case-body edit. Group B tail.

---

### 2.8 Full `flintConfig` → `ResolvedPolicy` migration (D3 — option B, APPROVED 2026-04-15)

**Defect:** `flintConfig: FlintConfig` carries a v1 `FlintPolicy` shape via the lossy `toLegacyFlintPolicy` adapter. Per-rule modes (`blocking|normative|advisory|off`) are not enforced anywhere that reads `flintConfig.policy.*.mode`. The Gatekeeper Rule (Commandment 6) is silently bypassed: Sprint 3 shipped a working policy engine but the gate still enforces v1 thresholds only.

**Scope (D3 option B):** Rewrite all 13 consumer reads in `server.ts` from `flintConfig.policy.*` to a hoisted `const resolved = loadAndResolvePolicy(projectRoot)` surface. Once migrated, **delete `toLegacyFlintPolicy` from `policyEngine.ts`** and drop the legacy `FlintConfig.policy` field. Grep confirms zero external consumers (see section 11).

**All 13 consumer sites mapped:**

| # | Line | Current read | ResolvedPolicy target | Notes |
|---|------|-------------|-----------------------|-------|
| 1 | 1904 | `flintConfig.policy.mithril.deltaE_threshold` | `resolved.mithril.deltaE_threshold` | direct field rename |
| 2 | 1905 | `flintConfig.policy.mithril.deltaE_critical_threshold` | `resolved.mithril.deltaE_critical_threshold` | direct field rename |
| 3 | 1908 | `flintConfig.policy.mithril.mode !== 'off'` | `resolved.mithril.mode !== 'off'` | ResolvedPolicy.mithril.mode retains global `off` semantics |
| 4 | 1911 | `flintConfig.policy.a11y.mode !== 'off'` | `resolved.a11y.mode !== 'off'` | ResolvedPolicy.a11y.mode retains global `off` semantics |
| 5 | 2544 | `flintConfig.projectRoot` | hoisted `projectRoot` (D8) | uses the already-hoisted callback-level constant |
| 6 | 2553 | `flintConfig.policy.a11y.disabled_rules` | `Object.entries(resolved.a11y.rules).filter(([, mode]) => mode === 'off').map(([ruleId]) => ruleId)` | **rules-where-mode-off filter** — lossy site replaced by precise per-rule mode lookup |
| 7 | 2554 | `flintConfig.policy.mithril.mode === "off"` | `resolved.mithril.mode === 'off'` | direct |
| 8 | 2556 | `flintConfig.projectRoot` (getOverrideTelemetryService) | hoisted `projectRoot` | direct |
| 9 | 2565 | `flintConfig.projectRoot` (ovrSvc.recordOverride) | hoisted `projectRoot` | direct |
| 10 | 2577 | `flintConfig.projectRoot` (ovrSvc.recordOverride mithril off) | hoisted `projectRoot` | direct |
| 11 | 2627 | `flintConfig.projectRoot` (enrichToolResult fix) | hoisted `projectRoot` | direct |
| 12 | 2657 | `findProjectRoot(resolvedFixPath) ?? flintConfig.projectRoot` | `findProjectRoot(resolvedFixPath) ?? projectRoot` | fallback term swap only |
| 13 | 4268 | `flintConfig.domains.join(", ")` in `runServer()` startup log | read `resolved.domains` directly from `loadAndResolvePolicy` OR keep as config metadata (NOT a policy field) | **kept on a slimmed `FlintConfig`** — `domains` is project metadata, not policy |

**Lossy site detail (row 6, line 2553):** Sprint 3 marked `disabled_rules` deprecated in `DEFAULT_RESOLVED_POLICY` (MINOR-11). The new canonical path is `resolved.a11y.rules` — a `Record<ruleId, 'blocking' | 'normative' | 'advisory' | 'off'>`. The rules-where-mode-off filter preserves the override-telemetry behavior exactly: each rule currently set to `off` is recorded as an override event. This closes Commandment 6 properly — Sprint 4 now routes per-rule mode truth into both the Mithril audit path AND the override telemetry path.

**Change:**
1. **Hoist once per request callback:** at the top of the `CallToolRequestSchema` callback (after D8's `projectRoot` hoist), add `const resolved = loadAndResolvePolicy(projectRoot);`. This is called once per tool invocation so policy edits via `flint_set_policy` are reflected on the next call without requiring global state reload. Same hoist added to `ReadResourceRequestSchema`.
2. **Rewrite all 13 sites** as mapped in the table. No `flintConfig.policy.*` reads remain after this phase.
3. **Slim `FlintConfig`:** remove the `policy: FlintPolicy` field from `flint-mcp/src/core/config.ts`. Keep `projectRoot` and `domains` as metadata fields.
4. **Delete `toLegacyFlintPolicy`** from `flint-mcp/src/core/policyEngine.ts` (line 1048). Update `flint-mcp/src/__tests__/policy-engine.test.ts` to remove the `Sprint 3: toLegacyFlintPolicy adapter` describe block.
5. **Update `loadConfig()`** in `config-loader.ts` to stop calling `toLegacyFlintPolicy`. The function now returns just `{ projectRoot, domains }`. Policy resolution is the caller's responsibility via `loadAndResolvePolicy(projectRoot)`.
6. **Document in HANDOFF** that `toLegacyFlintPolicy` was removed and per-rule modes now reach the gate.

**Acceptance:**
- `server.flintconfig-resolved.test.ts`: after `runServer`, grep assert that `flintConfig.policy` is `undefined`; a policy update via `flint_set_policy` propagates to the next `audit_ui_component` call (prove by setting a rule to `off` and seeing it land in override telemetry without a restart).
- Regression: `flint_audit` with a rule set to `advisory` mode no longer records it in override telemetry (advisory ≠ disabled).
- `policy-engine.test.ts` drops the adapter describe block, all other tests pass.
- `flint://rules` enrichment reads `resolved` directly (covered by 2.3 test).
- `npx tsc --noEmit` clean with `toLegacyFlintPolicy` export removed.

**Breaking-change ledger:** `toLegacyFlintPolicy` is removed from `policyEngine.ts` exports. Grep of `electron/`, `src/`, `server/`, and `flint-mcp/` confirms the only consumer outside `policyEngine.ts` itself is `flint-mcp/src/__tests__/policy-engine.test.ts` (which is updated in this sprint). No external (Electron, Glass, Web) consumers. This is a safe removal.

**Dependencies:** Touches `core/config.ts`, `core/config-loader.ts`, `core/policyEngine.ts`, `server.ts`, `__tests__/policy-engine.test.ts`. Must serialize against handler extraction (Group B) since several of the 13 sites live inside the `flint_audit` / `flint_fix` case bodies being extracted. **Order: do the D3 rewrite FIRST inside server.ts, then extract handlers against the post-migration signatures so the extracted handlers accept `resolved: ResolvedPolicy` in `ResolvedToolContext`.**

---

## 3. IPC Channels

None. MCP is a JSON-RPC surface, not an Electron IPC surface. No `window.flintAPI` changes.

## 4. Store Contracts

None. No Glass store changes.

## 5. Component Contracts

None. No UI work.

---

## 6. Commandment Checklist

| # | Commandment | Applies | Satisfied by |
|---|-------------|:-:|--------------|
| 6 | Gatekeeper | ✔ | `flint_set_policy` validation (2.2) prevents corrupted policies that would let the gate misfire |
| 13 | Deterministic surgery | n/a | No source-code transformation |
| 14 | Bypass prohibition | ✔ | All file reads in `flint://violations` go through `parseViolationsUri` sandbox (2.6) |

The other 13 commandments are out of scope for this sprint (no AST mutation, no AI model routing, no canvas ops).

---

## 7. Implementation Order

### Group A — Parallel (no shared file edits)

| Track | Agent | Files |
|-------|-------|-------|
| A1 | coder | `flint-mcp/src/tools/schemas.ts` (CREATE) |
| A2 | flint-mcp-specialist | `flint-mcp/src/core/rulePackRegistry.ts` (add `findPackForRule`) |
| A3 | coder | `flint-mcp/src/core/config.ts` + `core/config-loader.ts` (add `FlintConfig.resolvedPolicy` field, populate in `loadConfig`) |
| A4 | flint-test-writer | `tools/__tests__/rulePacks.zod.test.ts`, `__tests__/server.violations-uri.test.ts` (test scaffolds, depend only on schema/parser exports) |

### Group B — Serialized on `server.ts`

Order:
1. **Wire validation** — add validation hoist + projectRoot hoist + violations URI parser + rules resource enrichment (single commit, isolated to ReadResource and CallTool top frames). [coder]
2. **Extract handler 1: `flint_set_policy`** — also includes process.cwd fix and validation regression test. [coder]
3. **Extract handler 2: `flint_audit`** [coder]
4. **Extract handler 3: `flint_fix`** [coder]
5. **Extract handler 4: `flint_migrate_tw`** [coder]
6. **Extract handler 5: `flint_agent_trust`** [coder]
7. **Final test pass** — `flint-test-writer` writes `server.handler-extraction.test.ts`, `server.rules-resource.test.ts`, `server.flintconfig-resolved.test.ts`, `server.zod-validation.test.ts`. [flint-test-writer]
8. **CLAUDE.md update** [coder]

### Group C — Review gate

`/review` before commit. Then `flint-integration-validator` Phase 3.

---

## 8. Risks

| Risk | Severity | Commandment | Mitigation |
|------|:-:|:-:|------------|
| D3 rewrites 13 server.ts consumer sites inside case bodies that Group B will later extract — edit-order conflict risk | medium | 6 | Serialize: do the D3 rewrite as the first commit in Group B (before handler extraction). Extracted handlers receive `resolved: ResolvedPolicy` via `ResolvedToolContext`. Any merge conflict is localized to `server.ts`. |
| `toLegacyFlintPolicy` removal breaks an import path we didn't grep — silent build break | low | — | Section 11 grep complete: only `flint-mcp/src/__tests__/policy-engine.test.ts` imports it, and is updated in this sprint. TSC run at contract approval time validates. |
| Handler extraction breaks request/response shape because the case body had implicit access to outer-scope variables (`flintConfig`, `projectRoot`, `request.params.name`) | medium | — | Define `ResolvedToolContext` interface; pass everything explicitly; integration tests for each extracted tool. |
| Zod schema central registry diverges from JSON `inputSchema` declared on each tool — clients see one shape, server validates another | medium | — | Add a sanity test that iterates `TOOL_INPUT_SCHEMAS` and asserts every key is also in the tools/list response. |
| `findPackForRule` does not exist in rulePackRegistry — adding it requires reading 10 pack files at module init, may slow cold start | low | — | Build the reverse index lazily on first call and cache. |
| **MCP JSON-RPC test harness not yet present** — `server.handler-extraction.test.ts` may need a new harness that wraps `server.setRequestHandler` with synthetic requests | medium | — | flint-test-writer to check `flint-mcp/src/__tests__/` for an existing harness. If absent, build a minimal one (~30 LOC: synthesize a `CallToolRequest`, invoke the registered handler directly via `(server as any)._requestHandlers`). Flag for user if the SDK does not expose the registered handlers. |
| Windows URI test cannot run on POSIX CI — `process.platform` check makes the Windows branch dead in tests | low | — | Use `vi.stubEnv` / `vi.spyOn(process, 'platform', 'get')` to force the branch. |
| Glass / Electron consumers of `flint://rules` may break if they expected the old shape (raw rule JSON) | medium | — | Enrichment is additive — old fields preserved. New fields may be `null`. Verify no consumer destructures fields that don't exist. **Action:** grep `electron/` and `src/` for `flint://rules` consumers before merge. |
| Sprint 4 spec inaccurate (rule pack registration already done; set-policy validation already done) — risk of agent confusion | low | — | D4/D5 explicitly call out the reduced scope. Phase 1.5 contract linter should flag if any Phase 2 agent attempts to "register" tools that already exist. |

---

## 9. Risk Callouts for User (Phase 1.5 Pre-Approvals)

1. **D3 / Section 2.8** — Sprint 4 wires `ResolvedPolicy` into `flintConfig` as an additive `resolvedPolicy` field but does NOT migrate the ~10 consumer reads. Per-rule modes still won't be enforced at the gate after Sprint 4. Confirm this scope is acceptable, OR expand Sprint 4 to also rewrite consumer reads (adds ~3 hours).
2. **D4** — Rule pack tools are already registered. Sprint 4 cannot achieve the literal spec ("598 LOC dead → live") because they're not dead. Confirm reduced scope (Zod + tests + CLAUDE.md cleanup).
3. **D5** — `flint_set_policy` already validates via `mergeAndValidatePolicy`. Confirm reduced scope (regression test + `process.cwd()` fix).
4. **Risk row 5 — MCP test harness.** Phase 2 may need to build a JSON-RPC test harness from scratch. Confirm `flint-test-writer` is authorized to add ~30 LOC of test infrastructure.
5. **Risk row 7 — `flint://rules` consumers.** Need to grep Glass/Electron for downstream readers before Phase 2. If any exist that destructure or assume specific keys, contract may need amendment.

---

## 10. Non-goals

- Extracting handlers other than the 5 listed in D2.
- Validating `inputSchema` JSON against Zod schemas at build time (sanity test only).
- Renaming or restructuring the `flint://` URI namespace.
- Adding new MCP tools or resources.

**Explicitly IN-scope (upgraded from deferred):**

- **Full `flintConfig.policy.*` → `ResolvedPolicy` consumer migration** — all 13 sites rewritten (D3).
- **Removal of `toLegacyFlintPolicy` adapter** from `policyEngine.ts` and its test — D3 closes this.

## 11. External Consumer Grep (D3 pre-flight)

Grep performed 2026-04-15 before promoting status to APPROVED:

**`toLegacyFlintPolicy` consumers outside `flint-mcp/src/core/policyEngine.ts`:**
- `flint-mcp/src/__tests__/policy-engine.test.ts` — updated in this sprint (adapter describe block removed).
- `electron/` — zero matches.
- `src/` — zero matches.
- `server/` — zero matches.
- **Conclusion:** Safe to delete. No cross-process consumers.

**`flint://rules` consumers (for enrichment compatibility):**
- `electron/` — zero matches.
- `src/` — zero matches.
- `server/` — zero matches.
- Only references found: MCP capabilities index, workflow guide prompt, CLAUDE.md doc strings, and this contract.
- **Conclusion:** Enrichment is purely additive (old rule fields preserved via spread). No external destructuring risk.
