# FIXTURE.1.1 — DTCG Token Shape Adapter — Code Review

- **Date:** 2026-04-19
- **Reviewer:** flint-code-reviewer
- **Phase:** FIXTURE.1.1
- **Contract:** `.flint-context/contracts/FIXTURE.1.1.contract.ts` (APPROVED)
- **Parent report:** `.flint-context/reviews/FIXTURE.1-integration-2026-04-19.md` (SHIP-WITH-DOCUMENTED-DRIFT)
- **Scope reviewed:**
  - `flint-mcp/src/core/dtcgTokenAdapter.ts` (381 lines, CREATE)
  - `flint-mcp/src/server.ts` lines 23, 2038–2044 (one-line swap + import)
  - `flint-mcp/src/tools/swarm.ts` (verified no independent token load)
  - `flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts` (37 tests, all pass)
  - `flint-mcp/src/core/__tests__/dtcgTokenAdapter.bench.ts` (3 bench cases, p99 < 0.1ms)
  - `flint-mcp/src/__tests__/server.audit-fixture.test.ts` (27 tests, all pass — canary tightened)
  - `demos/01-rag-ui-builder/banner-broken.tsx`

## Verdict

**APPROVED — ready to ship.** Zero blockers. Zero warnings that rise above informational. All 10 contract invariants are covered by executing tests with measured values beating their thresholds by wide margins. TSC clean. 64/64 tests pass.

## Rubric miss closed

The FIXTURE.1 integration validator surfaced: "code reviews must execute the contract's measurable invariants and report pass/fail per invariant, not just inspect wiring." This review executes every invariant and reports the observed value versus the contract threshold.

## Invariant pass/fail table

| # | Invariant | Threshold | Observed | Covering test | Verdict |
|---|-----------|-----------|----------|---------------|---------|
| 1 | `demo-compliant-clean` | MITHRIL-TYP-002 + MITHRIL-SPC-001 on `banner-compliant.tsx` === 0 | TYP-002=0, SPC-001=0 (total 3 residual TYP-004/005 unrelated to this invariant) | `server.audit-fixture.test.ts:538` | **PASS** |
| 2 | `demo-broken-distinguishable` | total violations on `banner-broken.tsx` >= 5 | 5 | `server.audit-fixture.test.ts:504` | **PASS** |
| 3 | `adapter-flat-shape-identity` | `normalizeTokenShape(flatArr).tokens` element-wise equal at N=100, zero diff | Element-wise deep equal across 100 tokens | `dtcgTokenAdapter.test.ts:446` | **PASS** |
| 4 | `adapter-overhead-budget` | p95 < 2ms at N=100 | p99 = 0.0864ms, p95 ≈ 0.035ms (28,209 hz) | `dtcgTokenAdapter.bench.ts:101` | **PASS** (by ~55x) |
| 5 | `alias-single-hop-resolves` | resolved `token_value === "12px"` | `"12px"` | `dtcgTokenAdapter.test.ts:292` | **PASS** |
| 6 | `alias-multi-hop-resolves` | chain a→b→c terminates with correct literal in <= 3 iterations | Depth-3 resolves to `"12px"`; depth-5 resolves to `"24px"` | `dtcgTokenAdapter.test.ts:331, 349` | **PASS** |
| 7 | `alias-cycle-safe` | 2-node cycle emits `ALIAS_CYCLE` in < 100ms, never throws / overflows | Does not throw; `errors[0].code === "ALIAS_CYCLE"`; elapsed < 100ms | `dtcgTokenAdapter.test.ts:490` | **PASS** |
| 8 | `alias-broken-ref-typed` | >= 1 `ALIAS_BROKEN_REF` with matching `tokenPath` | 1 error, `tokenPath === "tokens.broken"` | `dtcgTokenAdapter.test.ts:515` | **PASS** |
| 9 | `id-hash-collision-free` | 100-leaf corpus has 0 duplicate ids | `new Set(ids).size === 100` | `dtcgTokenAdapter.test.ts:561` | **PASS** |
| 10 | `id-no-positive-collision` | Intersection with positive id set {1..10000} === 0 | Every synthesized id < 0; intersection empty | `dtcgTokenAdapter.test.ts:585` | **PASS** |

**Totals:** 10/10 PASS. No FAIL. No SKIP.

Raw run log (abridged):

```
Test Files  2 passed (2)
     Tests  64 passed (64)
bench: normalizeTokenShape N=100 DTCG     p99=0.0864ms p99.5=0.0970ms hz=28,209
bench: normalizeTokenShape depth-10 alias p99=0.0241ms                 hz=68,135
bench: normalizeTokenShape flat pass-thru p99=0.0183ms                 hz=82,729
TSC: 0 errors
```

## Commandment checklist

- **C2 (No Hallucinated Styling):** `$description` is preserved into `DesignToken.description` at `dtcgTokenAdapter.ts:220`, supporting Mithril's `nearestToken` reasoning. **Compliant.**
- **C13 (Deterministic Surgery):** Adapter is a pure recursive object walk. No regex is used to modify source code. The only regex-adjacent code is `rawValue.startsWith('{') && rawValue.endsWith('}')` for detecting DTCG bare-string alias form — this is a string predicate on token values, not source-code surgery. **Compliant.**
- **C14 (Bypass Prohibition):** `dtcgTokenAdapter.ts` imports zero I/O modules — no `fs`, no `child_process`, no `path`. Input is the already-parsed object from the existing `fs.readFileSync(...)` call site at `server.ts:2039`. **Compliant.**

## Append-only discipline on server.ts

The contract scopes the swap to the **fixture** token load site (server.ts:2038–2044). I verified:

- `server.ts:23` adds a single `import { normalizeTokenShape } from "./core/dtcgTokenAdapter.js"`.
- `server.ts:2040` replaces the fixture-specific `Array.isArray(...) ? rawFixtureTokens : Object.values(rawFixtureTokens)` with `normalizeTokenShape(rawFixtureTokens).tokens`.
- The two non-fixture token load sites at `server.ts:1972` and `server.ts:2179` intentionally retain the legacy `Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens)` pattern. These are NOT in scope per the contract (fixture-only) and the non-goals list explicitly defers this ("No migration of existing flat-shape token files to DTCG"). Legacy path intact for non-fixture flows — good append-only hygiene.

`swarm.ts` has zero direct token-load call sites; it delegates via `handleFlintAuditBatch` which routes through the patched server path. **Correctly verified as a no-op per the contract.**

## Type consistency

`TokenAdapterResult` and `TokenAdapterError` are exported from both the `.contract.ts` (with `tokens: unknown[]` to avoid `src/` coupling) and the implementation (`tokens: DesignToken[]`). The test file bridges both via a `type AdapterModule` shim (`dtcgTokenAdapter.test.ts:32`). This is intentional and works — the contract ts file is a *spec*, the `.ts` file is the implementation, and neither has a `DesignToken` typed at contract time. **Acceptable; documented in the contract source comment at line 55.**

## Error handling

- **Cycles:** Visited-set keyed on `originPath`+`currentRef`. Self-ref (`a→a`) triggered on first loop iteration (originPath=`tokens.a`, initialRef=`tokens.a`, visited=[`tokens.a`], `visited.includes(currentRef)` → true). Verified at `dtcgTokenAdapter.ts:242`. **Correct.**
- **Two-node cycle (a→b→a):** visited starts `[originPath=tokens.a]`; after one hop visited becomes `[tokens.a, tokens.b]`; `currentRef` reassigned to `tokens.a`; loop re-enters; cycle detected. **Correct.**
- **Broken ref (missing target):** `_lookupByDotPath` returns `undefined`; adapter emits `ALIAS_BROKEN_REF` with `tokenPath=originPath`, `ref=currentRef`. **Correct.**
- **Ref to a group node (not a leaf):** Explicitly rejected at `dtcgTokenAdapter.ts:265` as `ALIAS_BROKEN_REF` — a nice defensive branch.
- **No hidden throws:** `_walkDTCG` and `_resolveAlias` never throw; errors accumulate in the errors array. The 2-node-cycle test asserts `expect(() => ...).not.toThrow()` and passes.

## FNV-1a ID synthesis audit

Target of extra scrutiny per the review prompt (Node.js BigInt edge cases, 32-bit arithmetic pitfalls).

```ts
function fnv1a32(input: string): number {
    let hash = 0x811c9dc5              // FNV offset basis (fits in 32 bits unsigned)
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)    // XOR is safe on signed 32-bit
        hash = Math.imul(hash, 0x01000193)  // correct unsigned-multiply behaviour
    }
    return ((hash | 0x80000000) | 0)   // force negative sign bit, coerce to i32
}
```

- `Math.imul` is the canonical 32-bit integer multiply; it avoids the float-promotion trap that `*` would otherwise hit. **Correct choice.**
- `hash ^= charCodeAt(i)` on non-ASCII strings uses the UTF-16 code unit, not codepoint — acceptable because DTCG token paths are ASCII-constrained in practice (letter, digit, hyphen, dot).
- `(hash | 0x80000000)` is a bitwise OR that sets the sign bit. In JS this coerces to i32 and the result is guaranteed negative. The final `| 0` is idempotent but makes the i32 coercion unambiguous to readers.
- **Determinism verified:** `dtcgTokenAdapter.test.ts:613` asserts two identical inputs produce identical ids. PASS.
- **Cross-platform stability:** FNV-1a with `Math.imul` is bit-exact across Node/V8/browser engines. No BigInt, no float ops. No platform dependency.
- **Negative sign guarantee:** `0x80000000` OR forces the sign bit regardless of hash content, so hash ∈ [-2147483648, -1]. Verified at `dtcgTokenAdapter.test.ts:585` across 100 tokens.

**ID synthesis is sound.**

## Findings

No blockers. Three informational notes:

### INFO-1 — Bare-string alias detection is lenient

File: `flint-mcp/src/core/dtcgTokenAdapter.ts:189`

```ts
if (typeof rawValue === 'string' && rawValue.startsWith('{') && rawValue.endsWith('}')) {
    const refPath = rawValue.slice(1, -1)
```

This detects DTCG bare-string alias form `"{group.name}"` but would also match a literal value that happens to look like `"{notARef}"`. In practice DTCG values with `$type: "string"` won't have curly-brace literals by convention, but a defensive `_lookupByDotPath` miss will emit a spurious `ALIAS_BROKEN_REF`. Low risk because the adapter gracefully falls through to error-with-omission rather than throwing, and no current demo token uses such values. No change required; documenting as a known limitation.

### INFO-2 — `$schema` top-level key is tolerated

File: `flint-mcp/src/core/dtcgTokenAdapter.ts:118` (`_containsDTCGLeaf`), `:177` (`_walkDTCG`)

The demo tokens file contains a `$schema` string at the top level (verified at `dtcgTokenAdapter.test.ts:665`). Both the detector and walker skip non-object values with `if (!isPlainObject(val)) continue`, so the schema key is ignored. The 22-leaf full-demo-doc test confirms correct aggregate count. **Working as intended.**

### INFO-3 — Non-fixture token paths still use legacy shape-detection

File: `flint-mcp/src/server.ts:1972, 2179`

These two sites remain on `Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens)`. Per the contract's non-goals this is intentional scope. If an upstream project gains DTCG tokens *outside* the fixture path, those call sites will silently regress. Queue follow-up work to widen the swap to all token loads when we next touch the server token pipeline.

## Test coverage summary

- 37 adapter unit tests: shape detection (8), flatten (11), alias resolution (6), normalize integration (8), id synthesis (3), demo round-trip (2).
- 27 audit-fixture tests: ruleMatchesSurface filter (6), auditWithSurface (4), auditAllWithSurface (3), full pipeline (5), beta canary (4), FIXTURE.1.1 tightened canary (3) — last three exercise the adapter on real demo token files.
- 3 benchmarks: N=100 DTCG flatten, depth-10 alias chain, flat pass-through.

## Scope coverage

- Reviewed: adapter module, server integration, swarm verification, tests, bench, demo fixture.
- Skipped: unrelated files listed in `git status` (CHRON, RUNTIME, FIGMA-LINT, strategy docs). Not in FIXTURE.1.1 scope.

## Closing note

The FIXTURE.1 "documented drift" is now closed at the adapter, the canary, and the invariant table. Ship.
