# FIXTURE.1.1 — DTCG Token Shape Adapter (Contract Artifact)

**Phase:** FIXTURE.1.1
**Status:** APPROVED
**Audience:** engine
**Owner:** flint-architect
**Date:** 2026-04-19
**Closes:** Drift from `FIXTURE.1` integration report (SHIP-WITH-DOCUMENTED-DRIFT, 2026-04-19) — invariant `demo-compliant-clean === 0`.

Companion executable contract: [`FIXTURE.1.1.contract.ts`](./FIXTURE.1.1.contract.ts)

---

## 1. Background

FIXTURE.1 wired per-directory fixtures. `resolveFixture` correctly locates `design-tokens.json` for each demo. Tokens load. But `banner-compliant.tsx` still reports 5 MITHRIL violations (4× MITHRIL-TYP-002 on `12px/24px/16px/14px`, 1× MITHRIL-SPC-001 on `48px`) — every value that has a direct DTCG equivalent in `demos/01-rag-ui-builder/design-tokens.json`.

### Root cause (confirmed)

`flint-mcp/src/server.ts:2038`:

```ts
tokens = Array.isArray(rawFixtureTokens) ? rawFixtureTokens : Object.values(rawFixtureTokens);
```

`design-tokens.json` in `demos/01-rag-ui-builder/` is DTCG nested:

```json
{
  "fontSize": {
    "xs": { "$type": "dimension", "$value": "12px", "$description": "..." },
    ...
  }
}
```

`Object.values()` on the top level yields **groups** (`{xs: {...}, sm: {...}, ...}`), not `DesignToken` entries. `MithrilLinter.visitTypography` at line 780 then filters `tokens.filter(tok => tok.token_type === 'dimension')` against objects with no `token_type` field, producing an empty set — so every literal pixel mismatches the (empty) token registry.

The linter's consumer shape is `DesignToken[]` where each entry has `{ token_path, token_type: TokenType, token_value: string, ... }` (flint-mcp/src/types.ts:26). DTCG `$type` values for `dimension | color | fontFamily | ...` align directly with Flint `TokenType`, so the adapter is a pure flatten + rename, not a semantic translation.

## 2. Architectural Answer

A single pure-function adapter module:

```ts
// flint-mcp/src/core/dtcgTokenAdapter.ts
export function isDTCGDocument(raw: unknown): boolean
export function flattenDTCGTokens(raw: unknown): DesignToken[]
export function normalizeTokenShape(raw: unknown): DesignToken[]
```

- `normalizeTokenShape` is the **single integration point**. It auto-detects:
  - Already a flat `DesignToken[]` → return as-is.
  - DTCG document (nested, `$value`/`$type` on leaves) → recursively flatten; build `token_path` as dot-joined group chain (e.g. `fontSize.xs`); map `$type` → `token_type`; `$value` → `token_value`; `$description` → `description`; `collection_name: 'fixture'`; `mode: 'default'`; synthesize a stable `id` (negative integer hash of path to avoid collisions with SQLite-sourced positive ids).
  - **Alias resolution (in-scope):** DTCG alias leaves of the form `{ $value: { $ref: "fontSize.xs" } }` OR the DTCG-standard `{ $value: "{fontSize.xs}" }` string form are resolved against the same document by `token_path`. Single-hop and multi-hop (≥ 3 deep) chains both resolve deterministically via iterative lookup with a visited-set guard. Broken `$ref` (target not found) and cycles (`a → b → a`) emit a typed `TokenAdapterError` and the offending leaf is omitted from `tokens`; the adapter never throws and never stack-overflows.
  - Unknown shape → return `[]` and push a single `warnings` entry (engine-side telemetry only).
- **Append-only integration:** replace the one-liner at `server.ts:2038` with `tokens = normalizeTokenShape(rawFixtureTokens)`. Same single-call replacement in `swarm.ts` wherever it reads fixture-declared tokens. No changes to any visitor in `MithrilLinter.ts`.

**Why a new module and not extending `normalizer.ts`:** `electron/normalizer.ts` lives in the Electron process and maps Figma API payloads → DTCG. We need the inverse direction (DTCG → flat `DesignToken[]`) and it must be callable from the MCP engine (`flint-mcp/`). Importing from `electron/` across the process boundary violates Directive 9. Adapter lives engine-side.

## 3. Impact Map

| File | Change | Owner |
|---|---|---|
| `flint-mcp/src/core/dtcgTokenAdapter.ts` | CREATE — pure adapter module | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts` | CREATE — adapter unit tests (shape detection, flatten, edge cases) | flint-test-writer |
| `flint-mcp/src/server.ts` | MODIFY — replace the ad-hoc `Array.isArray/Object.values` line at ~2038 with `normalizeTokenShape` call. Identical replacement in the `flint_audit` handler in the same file. | flint-ast-surgeon |
| `flint-mcp/src/tools/swarm.ts` | MODIFY — verify token-load parity; delegates to `handleFlintAuditBatch` → `server.ts:2038`, so the server.ts fix should propagate. Apply swap only if swarm has an independent load site. | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/dtcgTokenAdapter.bench.ts` | CREATE — vitest bench measuring `adapter-overhead-budget` invariant (p95 < 2ms at N=100); pattern mirrors `tailwindConfigLoader.bench.ts`. | flint-test-writer |
| `flint-mcp/src/__tests__/server.audit-fixture.test.ts` | MODIFY — un-skip / tighten the drifted canary: `banner-compliant.tsx` Mithril count === 0. | flint-test-writer |

**Coordination notes:**
- Touches MithrilLinter's token **consumer shape** layer, NOT the visitor / rule code. Append-only vs RUNTIME.1 and FIGMA-LINT.1.
- No collision with parent FIXTURE.1 — that work already landed. This is a one-line swap at the token-load site + a new module + tests.
- No new MCP tool, no IPC, no Zustand store, no Glass surface change.

## 4. Type Contracts

All exported from `FIXTURE.1.1.contract.ts`:

- `DTCGLeaf` — `{ $value: string | { $ref: string }; $type?: string; $description?: string }` (the per-token node shape in DTCG; `$value` may be an alias ref object or the bare-string form `"{group.name}"`).
- `DTCGDocument` — recursive `{ [group: string]: DTCGDocument | DTCGLeaf }`.
- `TokenAdapterError` — `{ code: 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF'; tokenPath: string; ref: string; chain?: string[] }` typed error emitted to `TokenAdapterResult.errors` when alias resolution fails.
- `TokenAdapterResult` — `{ tokens: DesignToken[]; unknownShape: boolean; leafCount: number; errors: TokenAdapterError[] }` (the diagnostic-rich return of `normalizeTokenShape` for logging at call sites; `server.ts` uses `.tokens`).

## 5. IPC Channels

**None.** Engine-internal change.

## 6. Store Contracts

**None.**

## 7. Component Contracts

**None.**

## 8. Commandment Checklist

| # | Commandment | How this contract satisfies it |
|---|---|---|
| 2 | No Hallucinated Styling | Adapter preserves DTCG `$description` into `DesignToken.description` so Mithril's `nearestToken` suggestions cite the author-intended token. |
| 13 | Deterministic Surgery | Adapter is a pure recursive object walk. No regex on source code. Stable output for stable input. |
| 14 | Bypass Prohibition | Adapter does zero I/O. Input is a `JSON.parse`'d object from the existing `fs.readFileSync` call site. |

## 9. Implementation Order

Single parallelism group (trivial scope):

| Group | Agents | Work |
|---|---|---|
| A | `flint-ast-surgeon` | Create `dtcgTokenAdapter.ts` + swap the 2 call sites. |
| A | `flint-test-writer` | Adapter unit tests + tighten `server.audit-fixture.test.ts` canary. Starts once adapter signatures land. |

## 10. Risks

- **Flat-shape regression.** Existing flint projects use flat `DesignToken[]` JSON files. The adapter must be a strict no-op on already-flat input. Covered by invariant `adapter-flat-shape-identity` and a fixture test.
- **Alias cycles / broken refs.** Resolution is iterative with a visited-set guard keyed on `token_path`. Cycles terminate with `ALIAS_CYCLE` error; missing targets emit `ALIAS_BROKEN_REF`. Covered by invariants `alias-cycle-safe` and `alias-broken-ref-typed`.
- **Hash id collisions (engine-side evidence).** Justin verified negative FNV-1a is safe via grep: `flint-mcp/src/types.ts:27` types `DesignToken.id` as `number` with no positivity constraint; `librarySeedTokens.test.ts:18` asserts only `typeof === 'number'`; `MithrilLinter.ts:780` filters on `token_type`, never `id`; SQLite `token_source.id` is a **string** primary key (`syncSchema.ts:37`), not the numeric `DesignToken.id`; library adapters (`shadcnAdapter.ts:301,352`, `tailwindAdapter.ts:89,104`, `init/tokenExtractor.ts:480`) never compare `id` to zero, never use it as a SQL auto-increment. Covered by invariants `id-hash-collision-free` and `id-no-positive-collision`.

## 11. Non-Goals

- No **cross-file** DTCG alias resolution. `$ref` targets must live inside the same document loaded by the fixture resolver; multi-file token graphs are out of scope.
- No mode/theme fan-out from DTCG `$extensions`.
- No new MCP tool, no IPC, no store, no UI.
- No migration of existing flat-shape demo token files to DTCG.
- No changes to any Mithril visitor or rule.
- No changes to `normalizer.ts` (that module stays Figma-only).
- No new telemetry beyond a diagnostic count returned from `normalizeTokenShape`.
- No Phase 0 `CoverageVerdict` changes.

## 12. Verification (Invariants)

See [`FIXTURE.1.1.contract.ts`](./FIXTURE.1.1.contract.ts) `CONTRACT.invariants`. Headlines:

- `demo-compliant-clean` — Mithril count on `demos/01-rag-ui-builder/banner-compliant.tsx` === 0 (closes the FIXTURE.1 drift).
- `demo-broken-distinguishable` — `banner-broken.tsx` total violations ≥ 5 (preserves parent invariant).
- `adapter-flat-shape-identity` — `normalizeTokenShape(flatArr).tokens.length === flatArr.length` with element-wise equality.
- `adapter-overhead-budget` — `normalizeTokenShape` p95 < 2ms at N=100 leaves (load-time budget).
- `alias-single-hop-resolves` — `{ $value: { $ref: "a.b" } }` resolves to the target leaf's literal value.
- `alias-multi-hop-resolves` — chains of depth ≥ 3 resolve deterministically in ≤ chain-length iterations.
- `alias-cycle-safe` — a 2-node cycle terminates in ≤ N iterations and emits `ALIAS_CYCLE` error; no stack overflow.
- `alias-broken-ref-typed` — an unresolvable `$ref` emits `ALIAS_BROKEN_REF`; leaf is omitted from `tokens`.
- `id-no-positive-collision` — no adapter-synthesized id overlaps any id in the project's existing positive `DesignToken.id` range.

---

**Phase 2 entry condition:** Phase 1.5 lint approves this contract and `FIXTURE.1.1.contract.ts` compiles cleanly.
