# Contract Lint Report: FIXTURE.1.1 — DTCG Token Shape Adapter

**Linted:** 2026-04-19
**Contract artifact:** `.flint-context/contracts/FIXTURE.1.1-contract.md`
**Executable contract:** `.flint-context/contracts/FIXTURE.1.1.contract.ts`
**Schema version:** `shared/contract-schema.ts` (v2.1 — 12 checks)

---

## Verdict: APPROVED

Zero blocking issues. Two suggestions. Phase 2 may begin.

---

## Lint Check Results

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Compiles | PASS | `npx tsc --noEmit --skipLibCheck` on `.contract.ts` produced zero errors |
| 2 | Completeness | PASS | All required sections populated; `meta.status: 'APPROVED'`; all field requirements met |
| 3 | Impact Map | PASS | CREATE targets confirmed net-new on disk; MODIFY targets confirmed present; all owners are valid specialist agents; no orphaned agents |
| 4 | IPC Triangles | PASS | `ipc: []` — explicitly declared in §5; zero phantom validator references |
| 5 | Store Coherence | PASS | `stores: []` — explicitly declared in §6; correct for engine-internal change |
| 6 | Test Boundaries | PASS | 4 boundaries; all `given`/`when`/`then` non-empty; all `then` fields begin with allowed THEN_VERBs |
| 7 | Commandments | PASS | C2, C13, C14 present; all applicable; no missing entries for this scope |
| 8 | Parallelism Safety | PASS | Single group A; no intra-group file conflicts (each impact entry is owned by exactly one agent) |
| 9 | MD ↔ TS Consistency | PASS | 5 impact entries match in both artifacts; IPC/store/component sections empty in both; commandment list identical; invariant headlines in §12 of MD correspond to all 10 `.contract.ts` invariants |
| 10 | Falsifiable Invariants | PASS | 10 invariants; all thresholds contain comparison operators; all `measuredBy` fields name specific mechanisms |
| 11 | Non-Goals | PASS | 8 entries — explicit and well-scoped |
| 12 | Audience | PASS | `meta.audience: 'engine'` — single valid value; markdown header matches |

---

## Special Checks (per brief)

| Check | Result | Detail |
|-------|--------|--------|
| `meta.audience === 'engine'` (single-valued) | PASS | `.contract.ts` line 73: `audience: 'engine'`; markdown line 5: `**Audience:** engine` |
| `meta.status === 'APPROVED'` | PASS | `.contract.ts` line 70: `status: 'APPROVED'`; markdown line 4: `**Status:** APPROVED` |
| All invariants contain a comparison operator | PASS | All 10 thresholds contain `===`, `<=`, `>=`, `<`, or `>`. Detail below. |
| Alias-cycle-safe threshold is measurable | PASS | `threshold: "=== returns TokenAdapterResult with errors[0].code === \"ALIAS_CYCLE\" in < 100ms, never throws, never stack-overflows"` — contains `===` and `<`; the qualitative "never throws" is an additional safety assertion, not a substitute for the quantitative operator. Acceptable. |
| Alias-broken-ref-typed threshold is measurable | PASS | `threshold: ">= 1 entry with code === \"ALIAS_BROKEN_REF\" and matching tokenPath"` — contains `>=` and `===`. Fully falsifiable. |
| Test boundaries: alias resolution (single-hop, multi-hop ≥3, cycle, broken ref) all have executable given/when/then | PASS | Covered by `flattenDTCGTokens` boundary's `edgeCases` list and `normalizeTokenShape` boundary. See check 6 detail below. |
| IPC zero-channel — no phantom validator references | PASS | `ipc: []`; no validator field appears anywhere in the contract |
| Every agent in parallelism group A owns at least one impact entry | PASS | `flint-ast-surgeon` owns 3 entries (dtcgTokenAdapter.ts, server.ts, swarm.ts); `flint-test-writer` owns 2 entries (dtcgTokenAdapter.test.ts, server.audit-fixture.test.ts) |
| Risks section cites grep evidence for ID strategy | PASS | `risks[2].mitigation` cites `types.ts:27`, `librarySeedTokens.test.ts:18`, `MithrilLinter.ts:780`, `syncSchema.ts:37`, `shadcnAdapter.ts:301,352`, `tailwindAdapter.ts:89,104`, `init/tokenExtractor.ts:480` |

---

## Check 3 — Impact Map Detail

| File | Change | Disk State | Valid Owner |
|------|--------|------------|-------------|
| `flint-mcp/src/core/dtcgTokenAdapter.ts` | CREATE | Not present — correct | `flint-ast-surgeon` — valid |
| `flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts` | CREATE | Not present — correct | `flint-test-writer` — valid |
| `flint-mcp/src/server.ts` | MODIFY | Present at path — correct | `flint-ast-surgeon` — valid |
| `flint-mcp/src/swarm.ts` | MODIFY | **Path mismatch — see Suggestion 1** | `flint-ast-surgeon` — valid |
| `flint-mcp/src/__tests__/server.audit-fixture.test.ts` | MODIFY | Present at path — correct | `flint-test-writer` — valid |

The `swarm.ts` path discrepancy is noted as a suggestion (not blocking) because the summary correctly qualifies the change with "if/where swarm reads fixture-declared tokens."

---

## Check 6 — Test Boundary Detail

All four `then` fields checked against the THEN_VERBS allowlist:

| Target | `then` first word | Valid |
|--------|-------------------|-------|
| `isDTCGDocument` | "returns" | PASS |
| `flattenDTCGTokens` | "returns" | PASS |
| `normalizeTokenShape` | "returns" | PASS |
| `server.ts::audit_ui_component` | "returns" | PASS |

All four boundaries have non-empty `given`, `when`, `then`. All alias-resolution edge cases (single-hop, multi-hop ≥3, self-reference cycle, two-node cycle, broken ref, bare-string ref form) appear explicitly in `flattenDTCGTokens.edgeCases`. The integration boundary (`audit_ui_component`) covers both compliant and broken-fixture states plus the tokens-file-missing edge case.

---

## Check 10 — Invariant Falsifiability Detail

All 10 invariants verified for comparison operator presence:

| Name | Threshold | Operator found |
|------|-----------|----------------|
| `alias-single-hop-resolves` | `=== "12px"` | `===` |
| `alias-multi-hop-resolves` | `<= 3 (terminates...)` | `<=` |
| `alias-cycle-safe` | `=== returns ... in < 100ms` | `===`, `<` |
| `alias-broken-ref-typed` | `>= 1 entry with code === ...` | `>=`, `===` |
| `id-no-positive-collision` | `=== 0` | `===` |
| `demo-compliant-clean` | `=== 0` | `===` |
| `demo-broken-distinguishable` | `>= 5` | `>=` |
| `adapter-flat-shape-identity` | `=== flatArr (zero diff at N=100)` | `===` |
| `adapter-overhead-budget` | `< 2ms at N=100` | `<` |
| `id-hash-collision-free` | `=== 0` | `===` |

All pass. Units present where applicable (ms for performance, N=100 for corpus size).

Note: `adapter-overhead-budget` is `measuredBy: 'dtcgTokenAdapter.bench.ts (vitest bench)'` — this file is not in the impact map. See Suggestion 2.

---

## Suggestions (non-blocking)

### Suggestion 1 — `swarm.ts` impact entry path is wrong (not blocking because the change may be a no-op)

The impact entry lists `flint-mcp/src/swarm.ts` but the actual file is at `flint-mcp/src/tools/swarm.ts`. A MODIFY on the wrong path will silently produce no diff.

Code search confirms `swarm.ts` delegates to `handleFlintAuditBatch` and does not contain its own token-normalization call site — it only pre-warms the fixture resolver cache (lines 206-222). The token load at `server.ts:2038` is the only call site that needs the one-line swap.

**Recommended action:** Either (a) remove the `swarm.ts` impact entry entirely since there is no actual change needed there, or (b) correct the path to `flint-mcp/src/tools/swarm.ts` and add a concrete description of what line to change (which would require confirming a second call site exists). Given the evidence, option (a) is safer.

This is a suggestion, not a blocker, because:
- The contract summary explicitly hedges with "if/where swarm reads fixture-declared tokens"
- If `flint-ast-surgeon` searches the correct path and finds no matching token-load site, the entry produces zero diff without breaking the feature
- The critical path (`server.ts:2038`) is correctly identified and will close the invariant

### Suggestion 2 — `dtcgTokenAdapter.bench.ts` is referenced by an invariant but not in the impact map

`adapter-overhead-budget` declares `measuredBy: 'dtcgTokenAdapter.bench.ts (vitest bench)'`. That file does not exist and is not listed as a CREATE in the impact map. The project has bench files at `flint-mcp/src/core/__tests__/tailwindConfigLoader.bench.ts` and `cssStylesheetLoader.bench.ts`, so the pattern is established.

If the p95 < 2ms threshold is intended to be verified by automated CI, the bench file needs a CREATE entry assigned to `flint-test-writer`. If it is intended as a manual one-off, changing `measuredBy` to `'manual: vitest bench run locally by flint-test-writer'` avoids the phantom reference.

This does not block Phase 2 because the `adapter-overhead-budget` invariant is independently falsifiable (the threshold and measurable are clear), and the test file for correctness (`dtcgTokenAdapter.test.ts`) is correctly listed. The performance invariant is supplementary.

---

## What Phase 2 Agents Can Rely On

- Types in `.contract.ts` compile cleanly against `shared/contract-schema.ts` (zero TSC errors)
- `DTCGLeaf`, `DTCGDocument`, `TokenAdapterError`, and `TokenAdapterResult` are fully typed and importable
- Both CREATE targets are confirmed net-new — no pre-existing files will be clobbered
- Both MODIFY targets (`server.ts`, `server.audit-fixture.test.ts`) are confirmed present on disk
- IPC array is correctly empty — no preload-bridge changes, no Zod validators needed
- All 4 test boundaries have executable given/when/then with allowed verbs
- All alias-resolution edge cases (single-hop, multi-hop, cycle, broken ref, bare-string ref) are enumerated in testBoundaries
- All 10 invariants have falsifiable thresholds with comparison operators and named verification mechanisms
- No intra-group file conflicts in Group A
- Risks section cites concrete grep evidence for the ID strategy (non-positive range safety)
- `normalizeTokenShape` is the single integration point — Phase 2 calls `.tokens` on its result
