# Unified A+ Sweep — Complete Work Queue

> **Goal:** Fix every CRITICAL, MAJOR, test-coverage gap, and structural blind spot across the entire Flint codebase. No area left unaudited. No production file left untested.

## Scope Summary

| Tier | Sprints | Focus | Criticals | Majors | Untested LOC |
|------|:---:|---|:---:|:---:|:---:|
| **1 — Credibility & Correctness** | 1–6 | Fix findings from existing A+ reviews | 9 | 35 | — |
| **2 — Test Coverage & Reliability** | 7–10 | Cover never-tested production surfaces | 0 | 0 | ~18,000 |
| **3 — Hygiene & Completeness** | 11–12 | Dead code, doc drift, chronic failures, never-reviewed files | 0 | 5+ | ~3,000 |

**Total: 9 CRITICALs, 40+ MAJORs, 31 chronic test failures, ~21,000 LOC of untested code.**

---

## User Review Required

> [!IMPORTANT]
> **Sprint 3 (Policy Engine)** is the biggest single intervention — collapsing three loaders into one. Options:
> - **(A)** Full unification (recommended — one session, clean state forever)
> - **(B)** Partial wire-up — route `flint_set_policy` through `validatePolicy` only
> - **(C)** Defer as tech debt

> [!IMPORTANT]
> **Sprint 5 (RAG branding):** The n-gram embeddings are not semantic. Options:
> - **(A)** Rebrand to "keyword + n-gram similarity" (fast, honest)
> - **(B)** Wire ONNX MiniLM for real embeddings (~4h)
> - **(C)** Both — rebrand now, add real embeddings later

> [!WARNING]
> **Sprint 6 (Demos):** `demo-before.tsx`/`demo-after.tsx` are byte-identical — confirm no external references before deletion.

> [!IMPORTANT]
> **Sprint 11 (Never-Reviewed Files):** `packImportService.ts` (1,610 LOC) and `planService.ts` (1,213 LOC) have never appeared in any of the 31 review documents. These need a full independent review before any fix work.

---

# Tier 1 — Credibility & Correctness

## Sprint 1: Governor Linters (7 files + 7 services)

**Review source:** [governor-linters-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/governor-linters-aplus-review-2026-04-12.md) + [governor-services-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/governor-services-aplus-review-2026-04-12.md)
**Est: 2h**

### Governor Linter Fixes

#### [MODIFY] [mutationPlanner.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/mutationPlanner.ts)
- **MAJOR:** Add `dark-mode-drift` classification branch (mirroring `motion-drift`)
- **MAJOR:** Register `replaceElement` and `swapMotionToken` in `MRS_OP_WEIGHTS` — currently all route to `riskGated` via unknown-op fallback
- **MAJOR:** Add `visual-regression` type branch (latent bug)
- **MINOR:** Type-aware `computeDriftConfidence()` — typography/spacing use different scales than color ΔE

#### [MODIFY] [compositionValidator.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/compositionValidator.ts)
- **MAJOR:** Mirror `mode003` guard in `exit` branch — depth-counter drifts when rule set to `'off'`
- **MAJOR:** Tighten `isPascalCase` to require at least one lowercase letter
- **MINOR:** Short-circuit duplicate comp-001 when both `forbiddenChildren` and `allowedChildren` fire

#### [MODIFY] [darkModeSafety.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/darkModeSafety.ts)
- **MAJOR:** Filter `shadow-md`, `ring-1`, `outline-offset-*` from `COLOR_UTILITY_RE` — guaranteed false positives
- **MAJOR:** Change `requiresDarkMode` severity ceiling from `critical` → `amber`
- **MAJOR:** Fix `findSemanticAlternatives()` semantic-companion filter

#### [MODIFY] [hydrationLinter.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/hydrationLinter.ts)
- **MAJOR:** Gate `value`/`defaultValue` scanning behind figma-informed path only
- **MINOR:** Case-insensitive flag on name patterns; stable IDs via `line-column`

#### [MODIFY] [AnimationLinter.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/AnimationLinter.ts)
- **MAJOR:** Remove dead `warnings` buffer; collapse to `warningsSoFar`
- **MAJOR:** Add `ease-initial` to safe list

#### [MODIFY] [tailwindVersionResolver.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/tailwindVersionResolver.ts)
- **MAJOR:** Guard empty-string `projectRoot`

#### [MODIFY] [fluidInterpolator.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/fluidInterpolator.ts)
- **MINOR:** Strip `'base'` from `BREAKPOINTS`; tighten vw decimal formatting

### Governor Service Fixes

#### [MODIFY] [driftTrendService.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/driftTrendService.ts)
- **MAJOR:** Fix adoption-score unit mismatch (events vs distinct files)

#### [MODIFY] [visualRegressionStub.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/visualRegressionStub.ts)
- **MAJOR:** Return `degraded: true` / `ok: false` when Glass bridge unavailable — no silent green

#### [MODIFY] [healthcare.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/domains/healthcare.ts)
- **MAJOR:** Enumerate all active A11y rules dynamically — hard-coded `A11Y-001..010` is a compliance defect cascading to government.ts

#### [MODIFY] [fintech.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/domains/fintech.ts)
- **MAJOR:** Verify `MITHRIL-SPC-TOUCH` rule ID exists and is consumed

#### [MODIFY] [visualAuditor.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/electron/visualAuditor.ts)
- **MAJOR:** Replace regex import/export stripping with Babel traversal (C13/C15 violation)
- **MAJOR:** Harden render timeout race with settled-guard

#### [MODIFY] [projectDetector.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/shared/projectDetector.ts)
- **MAJOR:** Symlink loop protection in `defaultCountFiles`
- **MAJOR:** Make `DetectorFS.exists` async

---

## Sprint 2: Glass UI (COUNSEL/MINT/FORGE)

**Review source:** [glass-ui-expansion-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/glass-ui-expansion-aplus-review-2026-04-12.md)
**Est: 1.5h**

#### [MODIFY] [GovernanceDashboard.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx)
- **MAJOR-1:** Guard all 5 `setTimeout` calls with `useRef<Set<number>>` + cleanup on unmount
- **MAJOR-2:** Extract `useGovernanceDelta` + `useGovernanceAudit` hooks; delete duplicate `Sparkline`
- **MAJOR-3:** Subscribe to `visualTree` at component top — `getState()` in render path breaks testability
- **MINOR:** Import `A11Y_FIX_GUIDE`/`MITH_FIX_GUIDE` from `ViolationCard` instead of redeclaring

#### [MODIFY] [ViolationCard.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/governance/ViolationCard.tsx)
- **MINOR:** Guard `CopySnippet` `setTimeout`; export fix-guide tables

#### [MODIFY] [TokenDetailPanel.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/TokenDetailPanel.tsx)
- **MINOR:** Wrap dialog in `<FocusTrap>`

#### [MODIFY] [PasteAuditModal.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/PasteAuditModal.tsx)
- **MINOR:** Proper error state instead of raw text dump

#### [NEW] [ContrastAuditPanel.test.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/__tests__/ContrastAuditPanel.test.tsx)
#### [NEW] [FixPreviewDrawer.test.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/__tests__/FixPreviewDrawer.test.tsx)

---

## Sprint 3: Policy Engine

**Review source:** [policy-mcp-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/policy-mcp-aplus-review-2026-04-12.md)
**Est: 2–3h (largest sprint)**

#### [DELETE] [policyLoader.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/policyLoader.ts)
- **CRIT-1 + CRIT-3:** Eliminate triple-loader. `config-loader.ts` → `policyEngine.resolvePolicy` → `ResolvedPolicy`.

#### [MODIFY] [policyEngine.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/policyEngine.ts)
- **CRIT-2:** Derive `KNOWN_*_RULES` from `errorTaxonomy.REGISTRY` (missing 50+ a11y, 10+ mithril rules)
- **MAJOR:** Clean `SEVERITY_RANK` — remove `advisory` alias collision
- **MINOR:** Validate `rawMode` in `coerceToResolved`; remove deprecated `disabled_rules`

#### [MODIFY] [config-loader.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/config-loader.ts)
- **MAJOR:** `{ strict?: boolean }` — fail on validation errors in CI
- **MAJOR:** Path-sandbox `resolveExtendsRef` — reject `..` traversal
- **MAJOR:** Canonicalize ref paths via `realpathSync`
- **MINOR:** Deep-merge `trust.profiles`; structured config event on YAML failure

#### [MODIFY] [configValidator.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/configValidator.ts)
- **MAJOR:** Validate `export_gate`, `environments` (recursive), `trust.profiles`, `enforcement`

#### [MODIFY] [errorTaxonomy.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/errorTaxonomy.ts)
- **MINOR:** Build `BY_RULE_ID` reverse index; add SYNC-001/SYNC-002 entries

---

## Sprint 4: MCP Server + Registrations

**Review source:** [policy-mcp-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/policy-mcp-aplus-review-2026-04-12.md)
**Est: 1.5h**

#### [MODIFY] [server.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/server.ts)
- **MAJOR:** Zod runtime validation at top of each `CallToolRequestSchema` case
- **MAJOR:** Wire `flint_set_policy` through `policyEngine.validatePolicy` (depends on Sprint 3)
- **MAJOR:** Enrich `flint://rules` with `ruleMode`, `sourceAuthority`, `pack`
- **MAJOR:** Register the 5 rule pack tools from `rulePacks.ts` (598 LOC of dead handlers → live)
- **MINOR:** Begin extracting per-tool handlers from mega-switch
- **MINOR:** Fix violations URI path parsing for Windows; replace `process.cwd()` with `resolveProjectRoot()`

---

## Sprint 5: Component Registry + RAG

**Review source:** [registry-rag-aplus-review](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/registry-rag-aplus-review-2026-04-12.md)
**Est: 2h**

#### [MODIFY] [componentClassification.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/componentClassification.ts)
- **CRIT:** Gate `classifyComponentName` early return on validated `componentType`

#### [MODIFY] [registryService.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryService.ts)
- **CRIT:** Deep-merge `compositionRules` in `mergeTeamRegistryOverlay`; require `importPath` for new entries
- **MAJOR:** Field-weighted scoring (name=5, desc=3, variants=2, tokens=1, notes=1)
- **MAJOR:** Extend `PropDefinition` with `description`, `enum`, `deprecated`, `translatesFrom`
- **MAJOR:** `sourceId` tagging for multi-library conflict detection

#### [MODIFY] [ragRegistryService.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/ragRegistryService.ts)
- **MAJOR:** Atomic cache rebuild + generation counter

#### [MODIFY] [ragStore.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/ragStore.ts)
- **CRIT:** Rebrand from "semantic search" to "keyword + n-gram similarity"
- **MAJOR:** Collapse docs sources in summary; clamp `limit` to `[1, 100]`

#### [MODIFY] [registryResolver.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryResolver.ts)
- **MAJOR:** Reject refs with `..`, backslash, absolute paths

#### [NEW] [componentClassification.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/__tests__/componentClassification.test.ts) — full truth table
#### [NEW] [ragStore.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/__tests__/ragStore.test.ts) — ingest/query round-trip, empty table, seed
#### [NEW] [registryOverlay.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/__tests__/registryOverlay.test.ts) — team overlay merge
#### [NEW] [ragRegistryService.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/__tests__/ragRegistryService.test.ts)

---

## Sprint 6: Demos Dogfood Audit

**Review source:** [demos-ruthless-audit](file:///Users/tiemann/Lunar-Elevator-Bridge/.flint-context/reviews/demos-ruthless-audit-2026-04-12.md)
**Est: 1.5h**

#### [DELETE] `demos/demo-before.tsx` + `demos/demo-after.tsx` — byte-identical
#### [DELETE] `demos/_preview/main.tsx` — stale clone

#### [MODIFY] [corrupted-card.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/demos/06-macro-recovery/corrupted-card.tsx) — fix strict TSC failures
#### [MODIFY] [DemoPreview.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/demos/_preview/DemoPreview.tsx) — convert inline hex to Tailwind classes
#### [MODIFY] [violating-ux.tsx](file:///Users/tiemann/Lunar-Elevator-Bridge/demos/04-sentinel/violating-ux.tsx) — remove dead `shipToCountry`

#### Rewrite READMEs: `03/README.md` (wrong ΔE), `05/README.md` (fiction), `06/README.md` (fabricated A11y)
#### [NEW] `demos/01-rag-ui-builder/README.md` — explain which file is canonical Demo 1

#### [MODIFY] [DEMO-SCRIPT.md](file:///Users/tiemann/Lunar-Elevator-Bridge/demos/DEMO-SCRIPT.md) — update all counts from actual `audit_ui_component` output
#### [MODIFY] [demos/README.md](file:///Users/tiemann/Lunar-Elevator-Bridge/demos/README.md) — fix index table rows

---

# Tier 2 — Test Coverage & Reliability

## Sprint 7: Chronic Test Failure Cleanup

**Est: 1–1.5h**

> [!CAUTION]
> 31 test failures have been carried as "pre-existing" for weeks. A governance product that tolerates chronic red tests undermines its own authority. Fix first, ask questions never.

#### [MODIFY] [suggestedAction.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/__tests__/suggestedAction.test.ts)
- **28 chronic failures** — investigate root cause, fix assertions or update to match current behavior. If the feature was removed, delete the tests.

#### [MODIFY] [mithrilParity.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/shared/__tests__/mithrilParity.test.ts)
- **2–3 chronic failures** — investigate parity gap between shared and MCP linter

#### [MODIFY] [ws3-server.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/__tests__/ws3-server.test.ts)
- **1 chronic failure** — investigate WebSocket test infrastructure issue

#### Housekeeping
- Update HANDOFF.md header baseline: `3,612 MCP → 4,637` | `1,537 Glass → 2,218` | `1,087 Core → 1,454`
- Clean `console.log` debris from 26 production files (convert to `console.warn` with context or remove)

---

## Sprint 8: Server Web Build Tests

**Est: 3h**

> [!CAUTION]
> `server/` is the primary distribution channel (`npm run dev:web`). **6,336 lines of production code with zero test files.** This is the single largest test coverage gap in the project.

#### [NEW] [server/__tests__/index.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/__tests__/index.test.ts)
Focus areas for `server/index.ts` (3,801 LOC):
- HTTP handler request/response shapes for top-10 most-used IPC channels
- WebSocket message routing and broadcast
- Error propagation (generic messages, no stack leaks)
- `d2c:apply` path scoping to `activeProjectRoot`
- MCP tool allowlist enforcement
- File watcher event normalization

#### [NEW] [server/__tests__/mcpClient.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/__tests__/mcpClient.test.ts)
- JSON-RPC request/response round-trip
- Connection failure + reconnect behavior
- Tool call routing

#### [NEW] [server/services/__tests__/aiChat.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/__tests__/aiChat.test.ts)
- Streaming message shape
- API key handling (no key → structured error, not crash)
- Rate limiting / token counting

#### [NEW] [server/services/__tests__/thumbnailService.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/__tests__/thumbnailService.test.ts)
- PNG cache hit/miss
- ESM `__dirname` workaround verification
- Concurrent screenshot requests

#### [NEW] [server/services/__tests__/ingestionServer.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/__tests__/ingestionServer.test.ts)
- Variables/Assets/AST payload ingestion
- Rate limiting behavior
- Malformed payload handling

#### [NEW] [server/services/__tests__/librarySeedTokens.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/services/__tests__/librarySeedTokens.test.ts)
- Seed token generation for each supported library

#### [NEW] [server/__tests__/cli.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/server/__tests__/cli.test.ts)
- CLI argument parsing (--project, --port, --open)
- Port conflict handling

---

## Sprint 9: flint-ci CLI Tests

**Est: 2h**

> [!WARNING]
> `github-action.ts` (623 LOC) generates PR comments and SARIF for GitHub code scanning. An untested file producing structured output for external consumption is an enterprise reliability risk.

#### [NEW] [flint-ci/src/__tests__/audit.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/audit.test.ts)
- File collection + glob patterns
- Mithril + A11y audit delegation
- SARIF output schema validation
- Exit codes (0 = clean, 1 = violations, 2 = error)

#### [NEW] [flint-ci/src/__tests__/github-action.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/github-action.test.ts)
- PR comment markdown generation
- SARIF schema compliance (validate against SARIF 2.1.0 schema)
- Rate-limit handling for GitHub API

#### [NEW] [flint-ci/src/__tests__/fix.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/fix.test.ts)
- Dry-run default behavior
- Fix-and-write with atomic writes
- No-violations-found messaging

#### [NEW] [flint-ci/src/__tests__/interactive-fix.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/interactive-fix.test.ts)
- User prompt flow
- Selection state tracking

#### [NEW] [flint-ci/src/__tests__/diff.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/diff.test.ts)
- Diff report generation between baseline and current

#### [NEW] [flint-ci/src/__tests__/baseline.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/baseline.test.ts)
- Baseline snapshot create/compare

#### [NEW] [flint-ci/src/__tests__/init.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-ci/src/__tests__/init.test.ts)
- Config file generation
- Double-init safety

#### Remaining: `debt.test.ts`, `dbom.test.ts`, `sync-check.test.ts`, `cli.test.ts`

---

## Sprint 10: Electron Process Test Gaps

**Est: 2h**

#### [NEW] [electron/__tests__/preload.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/electron/__tests__/preload.test.ts)
**preload.ts — 1,548 LOC, the security boundary**
- Channel name/shape verification for top-20 highest-risk handlers
- Ensure no `fs`/`child_process` exposure through `contextBridge`
- IPC error propagation (structured, no stack traces to renderer)
- Type coverage for `window.flintAPI` surface

#### [NEW] Test files for untested electron modules:

| New test file | Target | Key scenarios |
|---|---|---|
| `ingestion-server.test.ts` | 513 LOC | Webhook payload validation, rate limiting, heal pass |
| `mrsEngine.test.ts` | 182 LOC | Risk score computation, tier classification |
| `normalizer.test.ts` | 223 LOC | Figma Variables → DTCG round-trip, edge cases |
| `rateLimiter.test.ts` | 124 LOC | Token bucket, burst, refill |
| `store.test.ts` | 332 LOC | SQLite CRUD, concurrent writes, table creation |
| `registry.test.ts` | 117 LOC | Component registration, lookup |
| `ragService.test.ts` | 160 LOC | ONNX embedding generation, query round-trip |
| `templateService.test.ts` | 91 LOC | Template scaffolding |

---

# Tier 3 — Hygiene & Completeness

## Sprint 11: Never-Reviewed File Audit

**Est: 2.5h**

> [!IMPORTANT]
> These two files have **never appeared in any of the 31 review documents.** They need a full independent A+ review followed by remediation.

#### [REVIEW + MODIFY] [packImportService.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/packImportService.ts) — 1,610 LOC
- Full A+ independent code review (no prior review exists)
- 3-way merge logic, conflict detection, snapshot rollback
- Security: pack content validation, path sandboxing
- Tests: conflict scenarios, rollback, merge strategies

#### [REVIEW + MODIFY] [planService.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/planService.ts) — 1,213 LOC
- Full A+ independent code review (no prior review exists)
- Plan state machine transitions
- Multi-step execution, error recovery
- Tests: plan lifecycle, step dependencies, failure modes

#### [REVIEW] MCP tool handlers (audit.ts 655L, rulePacks.ts 598L, enrich.ts 398L) — spot-check the top untested tools

---

## Sprint 12: Cleanup & Completeness Pass

**Est: 2h**

### Untested hooks
#### [NEW] Test files for 6 untested hooks:

| Hook | LOC | Risk | Test focus |
|---|:---:|---|---|
| `useGovernanceHealth.ts` | 127 | **High** — computes dashboard score | Math correctness, edge cases (0 violations, NaN guard) |
| `useIDEFileSync.ts` | 112 | **High** — core integration | Sync lifecycle, cleanup, reconnect |
| `useTokenUsage.ts` | 106 | Medium | Token analysis accuracy |
| `useUserPrefs.ts` | 93 | Medium | Persistence round-trip, defaults |
| `useRemotePresence.ts` | 79 | Low | Connection state |
| `useContrastAudit.ts` | 54 | Low | Contrast computation |

### Untested shared/ contracts
#### [NEW] Test files for shared infrastructure:

| File | LOC | Test focus |
|---|:---:|---|
| `ipc-validators.ts` | 213 | Zod schema validation — the Design-by-Contract layer |
| `constraintSerializer.ts` | 221 | Serialization round-trip, edge cases |
| `contract-schema.ts` | 207 | FlintContract validation |
| `ast-utils.ts` | 99 | Utility correctness |

### Untested store
#### [NEW] [astBufferStore.test.ts](file:///Users/tiemann/Lunar-Elevator-Bridge/src/store/__tests__/astBufferStore.test.ts)
- Multi-file AST buffer management, cross-file move, cleanup

### MCP Prompts (coverage pass)
- Add basic shape/export tests for `sentinel.ts` (28K LOC!), `workflow-guide.ts`, `quickAudit.ts`, `fixAll.ts`
- Focus: ensure each prompt returns valid `GetPromptResult`, argument validation works, domain presets in sentinel are all reachable

### Console.log cleanup
- Convert remaining ~26 `console.log` calls across `flint-mcp/`, `electron/`, `server/` to `console.warn('[Flint] context', err)` or remove

### Documentation sync
- Update HANDOFF.md header baseline to current test counts
- Update CLAUDE.md resource count (13 → actual, including `flint://governance/trends`)
- Verify `CLAUDE.md` tool count after Sprint 4 rule pack registration

---

## Open Questions

> [!IMPORTANT]
> 1. **Policy unification depth (Sprint 3):** Full (A), partial (B), or defer (C)?
> 2. **RAG branding (Sprint 5):** Rebrand only (A), real embeddings (B), or both (C)?
> 3. **demo-before/after deletion (Sprint 6):** External references?

---

## Verification Plan

### After every sprint

```bash
cd flint-mcp && npm test           # MCP engine
npm run test:react                  # Glass components
npm test                            # Core/Electron
npx tsc --noEmit                    # Type check
```

Report format:
```
MCP:   XXXX/XXXX passing (N new)
Glass: XXXX/XXXX passing (N new)
Core:  XXXX/XXXX passing (N new)
TSC:   0 errors
```

### Per-Sprint Verification

| Sprint | Verification |
|--------|---|
| 1 | `audit_ui_component` against demo files — dark-mode-drift + motion-drift classify correctly |
| 2 | Open GovernanceDashboard, trigger fix, unmount within 2s — no "state update on unmounted" warning |
| 3 | `flint_set_policy` with invalid rule ID → validation error. `A11Y-011: off` → succeeds |
| 4 | Call tool with missing params → Zod error, not TypeError. Rule pack tools appear in `flint://capabilities` |
| 5 | `flint_query_registry` returns field-weighted results. Classification truth table green |
| 6 | `audit_ui_component` against every demo .tsx. `DemoPreview.tsx` has 0 `MITHRIL-IST-COL` violations |
| 7 | `cd flint-mcp && npm test` — **zero** pre-existing failures. All suites fully green |
| 8 | `server/` test suite passes independently. Each new test file covers happy + error + edge |
| 9 | `cd flint-ci && npm test` — all new test files green. SARIF output validates against schema |
| 10 | `electron/` tests cover preload channel shapes. No `any` escapes through contextBridge |
| 11 | New reviews written for packImportService + planService. Fixes applied. Tests added |
| 12 | All hooks tested. `console.log` count = 0 in production files. HANDOFF baseline matches reality |

### Final Verification

After all 12 sprints:
- **Zero** pre-existing test failures
- **Zero** `console.log` calls in production code
- **Every** file >100 LOC has a corresponding test file
- **Every** file >500 LOC has appeared in at least one A+ review
- `npm run dev:web` starts cleanly and Glass renders
- Walk through Demo 1–6 using DEMO-SCRIPT.md — all numbers match tool output
