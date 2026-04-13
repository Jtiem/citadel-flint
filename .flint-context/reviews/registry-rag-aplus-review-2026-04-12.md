# A+ Code Review — Component Registry & RAG Pipeline

**Date:** 2026-04-12
**Reviewer:** /review (quality gate)
**Scope:** Flint's component registry + RAG search — a core differentiator for design system adoption (Armory + RAG auto-seeding)

## Files Audited

| File | LOC | Role |
|------|-----|------|
| `flint-mcp/src/core/registryService.ts` | 353 | Text-search registry, Shadow Storybook formatter, team overlay merge, Figma ID lookup |
| `flint-mcp/src/core/componentClassification.ts` | 298 | Figma node name → component type classification (shared by hydroPaste, figmaMcpParser, figmaJsxTransformer) |
| `flint-mcp/src/core/ragRegistryService.ts` | 57 | In-memory registry cache wrapper around queryRegistry |
| `flint-mcp/src/core/registryResolver.ts` | 59 | GPX pack reference resolver (local cache lookup) |
| `flint-mcp/src/core/tokenImporter.ts` | 567 | JS/JSON/CSS → DTCG normalizer (not registry, but in scope) |
| `server/services/ragStore.ts` | 528 | sqlite-vec RAG store for the web build — n-gram hashing embeddings |
| `flint-mcp/src/core/__tests__/registryService.test.ts` | 365 | Existing test coverage for registry |
| `flint-mcp/src/core/__tests__/tokenImporter.test.ts` | 667 | Existing test coverage for token importer |

Also inspected for cross-reference: `flint-mcp/src/tools/remoteLibrary.ts`, `flint-mcp/src/server.ts`, `server/index.ts`.

---

## Grades Summary

| Module | Grade | One-line verdict |
|--------|-------|------------------|
| `registryService.ts` — text search + formatter | **B** | Correct and deterministic; team-overlay and Figma-ID paths are untested; scoring is brittle. |
| `registryService.ts` — `ComponentEntry` schema | **A-** | Rich; only gap is no PropDefinition `description` field for rogue-intrinsic hints. |
| `componentClassification.ts` | **C+** | Works, but has NO dedicated tests, duplicated rule tables, and a trusted-input override that bypasses classification. |
| `ragRegistryService.ts` | **B-** | Trivially correct but ships no eviction, no TTL, no concurrency guards, and zero tests. |
| `registryResolver.ts` | **B** | Safe and simple; minor path-traversal concern via pack ref injection. |
| `tokenImporter.ts` | **B+** | Thoughtfully no-eval; regex-based JS parse is fragile by design but well-tested. |
| `server/services/ragStore.ts` — RAG pipeline | **C** | Works for exact/substring matches but embedding quality is poor, **zero tests**, and two real bugs below. |

**Overall registry + RAG differentiator grade: B-**

The surface is well-designed and the contracts are clear, but the primary RAG implementation is built on toy embeddings with no measured relevance, the constrained-generation path has untested fallbacks, and the most strategically important code (the thing Flint uses to feed AI agents context) has the thinnest test coverage.

---

## CRITICAL findings (ship blockers for differentiator claim)

### C1 — RAG embeddings in `ragStore.ts` are not semantic, only lexical, but the code is branded as "semantic search"

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/server/services/ragStore.ts` lines 56–124

`embedText` hashes character n-grams (tri/quad) + word unigrams into a 384-dim bucket vector via FNV-1a. This is a **bag-of-n-grams sketch**, not an embedding. Two texts with zero shared n-grams but identical meaning (e.g. "button" vs "action trigger") return orthogonal vectors — distance ≈ `sqrt(2)`. This is indistinguishable from SQL `LIKE` and in many cases worse because of hash collisions compressing the space to 384 buckets.

This is a **marketing/architecture gap**, not a correctness bug — the file header even admits it is "approximate" — but it undermines the "RAG auto-seeding" claim in `CLAUDE.md` and the constrained-generation value prop. The header says "not as powerful as a neural model" — that should be loud in the UI too, or there should be a plan to swap in a real model for the Electron build.

**Fix:** Either (a) wire the Electron `ragService.ts` ONNX/transformer path through for Electron and keep this n-gram path only as the explicit web fallback, gated behind a `ragMode: "lexical" | "neural"` flag; or (b) ship a proper embedding (MiniLM via onnxruntime-web works in Node). Until one of these lands, do not call this RAG "semantic" in tool descriptions. Downgrade `flint_query_registry` docs to "keyword + n-gram similarity".

### C2 — `ragStore.ts` has zero tests

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/server/services/ragStore.ts`

`grep` across `**/__tests__/**` returns zero matches for `createRAGService`, `ragStore`, or `embedText`. The web build is the primary target as of 2026-04-04 (per project memory `project_web_primary.md`), and the only search path in that build has no unit tests — no happy path, no empty-table guard verification, no ingest round-trip, no L2-normalization check, no seedFromProject contract test.

Per the Testing Standard section in `CLAUDE.md`, every service "must test: empty input, boundary values, error conditions, concurrent access (for DB services)". This file satisfies zero of those.

**Fix:** Add `server/services/__tests__/ragStore.test.ts` covering: ingest → query round-trip, empty-table guard (line 302), clear() empties both tables, seedFromProject with manifest-only / tokens-only / docs-only / all-three, symlink skip in docs (line 480), malformed design-tokens.json survives without throwing, count() after ingest.

### C3 — `componentClassification.ts` has no dedicated test file, but three independent parsers depend on it

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/componentClassification.ts`

This is the canonical Figma-name → component-type map, used by hydroPaste, figmaMcpParser, and figmaJsxTransformer — i.e. everything in the Mason/D2C pipeline. The rule ordering is deliberately fragile (the `tab` vs `table` guard at line 170, "textarea before input" at line 138, the exact-match `hr` carve-out at line 246). A single reorder silently breaks classification for every D2C import.

There is no `componentClassification.test.ts`. The existing `figmaMcpParser.test.ts` covers some call sites but not the rule matrix itself.

**Fix:** Add `componentClassification.test.ts` with a **truth table** — every keyword in `ORDERED_SUBSTRING_KEYS` and every rule in `STRICT_CLASSIFICATION_RULES` needs a positive case plus the known adversarial negatives (`table`, `form field`, `profile-picture`, `toggle-button`, `navigation-bar`). At minimum the test should assert that both classifiers stay in sync for names in `COMPONENT_NAME_MAP` whose type is in `STRICT_COMPONENT_TYPES`.

### C4 — `classifyComponentName` blindly trusts the `componentType` parameter

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/componentClassification.ts` lines 237–241

```ts
if (componentType) {
    return { type: componentType as ComponentType, matchedKeywords: [`data-name:${componentType}`] }
}
```

This is a `as ComponentType` cast with no validation. Any upstream caller (Figma MCP enrichment, figmaMcpParser) can pass `componentType: "widget"` or `"button"` (which is NOT in `ComponentType` — it's in `DataNameType`) and produce an invalid classification that downstream emitters will either crash on or silently misroute.

**Fix:** Gate the early return on `COMPONENT_NAME_MAP[componentType] !== undefined` OR `STRICT_COMPONENT_TYPES.has(componentType)`. If the hint is not in the strict set, fall through to keyword classification and log a warning.

### C5 — `mergeTeamRegistryOverlay` has zero direct test coverage

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryService.ts` lines 68–96

The team-overlay merge is a P3 differentiator (per POL.1 team overlays) and its semantics are subtle: `addEntries` shallow-merges with the base entry, `importOverrides` rewrites last. A single unit test exercises none of these branches — `mergeTeamRegistryOverlay` does not appear in the test file.

Specific risks:
- Line 80: `...prev, ...entry` is a **shallow** merge. If the overlay provides `compositionRules: { allowedChildren: ['X'] }`, it **replaces** the base's `compositionRules` entirely, dropping `forbiddenChildren` / `maxDepth` / `requiredParent`. For a governance product this is a correctness bug.
- Line 82: `importPath: entry.importPath ?? prev.importPath ?? ''` silently produces an empty string when neither side sets it. An empty import path will make the Shadow Storybook emit ``import { X } from '';`` which is invalid TSX.

**Fix:** (a) Deep-merge `compositionRules`, `props`, and `tokens`; (b) require `importPath` when adding a net-new entry and throw on missing; (c) add tests for: new-entry add, existing-entry field merge, compositionRules deep-merge, importOverrides applied last, empty overlay returns a copy (not the same reference — already correct but untested).

---

## MAJOR findings

### M1 — `queryRegistry` scoring is word-presence, not frequency or field-weighted

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryService.ts` lines 141–164

Each query word contributes +1 iff it appears in any searchable field — one point per word per component, capped by the `break`. This means:
- A component whose `name` matches the query scores identically to one where the word appears only in a `compositionNotes` paragraph.
- Token names (which are often noisy: `color.brand.primary.500`) get the same weight as the component name.
- Relevance ties are broken by insertion order, which is non-deterministic across `Object.entries`.

For a system that is supposed to make "component suggestion" a differentiator, this is too crude.

**Fix:** Weight fields (name=5, description=3, variants=2, tokens=1, notes=1). Track query-word frequency. Tie-break alphabetically. Add a fuzzy-match fallback (Levenshtein-1 on `name`) for typo tolerance.

### M2 — `ComponentEntry.props` has no `description` field, blocking prop translation hints for rogue-intrinsic detection

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryService.ts` lines 11–15

```ts
export interface PropDefinition {
    type: string;
    required: boolean;
    default?: string;
}
```

There is no `description`, no `enum` (for literal unions), no `deprecated` flag, and no `translatesTo` (the "prop translation hint" the review prompt calls out). Rogue-intrinsic detection — "user wrote `<button>` but Constrained Registry says they should use `<Button variant='primary'>`" — needs to know which props on the library component correspond to which native attributes. Today the registry can't carry that mapping.

**Fix:** Extend `PropDefinition`:
```ts
interface PropDefinition {
    type: string
    required: boolean
    default?: string
    description?: string
    enum?: string[]          // for string-literal unions
    deprecated?: boolean
    /** Which native HTML attr this prop replaces, for rogue-intrinsic remediation. */
    translatesFrom?: string  // e.g. 'disabled', 'aria-label'
}
```

Update the manifest schema, the JSDoc extractor in Registry Enrichment, and the Shadow Storybook formatter.

### M3 — `registryService` has no duplicate-handling strategy

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryService.ts` lines 189–196

`queryRegistry` iterates `Object.entries(components)` — so "same component declared twice" is impossible in the current map-shaped API (the second overwrites the first). But the seeding path (`setRegistryCache` in `ragRegistryService.ts`, line 25) does `{ ...registryCache, ...components }` — meaning remote libraries silently clobber local ones with no warning, no provenance, and no user-facing conflict resolution.

For a multi-library project (shadcn + a team's internal kit), this is a known-in-advance conflict case that silently picks a winner based on ingestion order.

**Fix:** Tag entries with a `sourceId` (local manifest / remote pack name / team overlay). When `setRegistryCache` would overwrite a key, emit a governance event (`registry.duplicate`) and prefer local manifest > team overlay > remote library. Surface the conflict in the Scope panel.

### M4 — `ragStore.seedFromProject` pushes `docs/<file>` to `sources` per file, creating a noisy UI surface

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/server/services/ragStore.ts` line 491

```ts
chunks.push({ content, source: `docs/${filename}`, chunkType: 'documentation' })
sources.push(`docs/${filename}`)
```

`sources` is returned to callers for a human-readable "what was seeded" summary. `manifest` appears once, `tokens` appears once, but `docs` can produce dozens of entries. In the Glass UI this bloats the summary toast and makes the "seeded from 24 sources" count misleading (one project, one doc dir, ≠ 24 sources).

**Fix:** Collapse docs to a single `docs/ (N files)` entry in the summary, keep per-file `source` on the chunks themselves (that's fine — chunks use it for attribution), but aggregate for the return value.

### M5 — `searchStmt` in `ragStore.ts` is syntactically correct SQL but assumes `k` is the vec0 MATCH parameter — misuse returns wrong results

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/server/services/ragStore.ts` lines 280–291

```sql
WHERE v.embedding MATCH ? AND k = ?
ORDER BY v.distance
```

This is the documented sqlite-vec KNN syntax. The issue is that `limit` is parameterized as the `k` value (line 309: `searchStmt.all(vecBuffer, limit)`), not as a SQL `LIMIT`. If `limit = 0` is passed (legitimate caller error), sqlite-vec may throw or return an empty set depending on version. There is no validation: `query(queryText, 0)` → undefined behavior.

**Fix:** Clamp `limit` to `[1, 100]` at the top of `query()`, matching the defensive clamp already present in `registryService.queryRegistry` line 200.

### M6 — `registryResolver.resolveRegistryRef` has a path-traversal surface via the ref argument

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/registryResolver.ts` lines 29–31

```ts
function refToDirectoryName(ref: string): string {
    return ref.replace(/\//g, '--')
}
```

Slashes are replaced, but `..` is not. A ref of `"..--acme--pack"` (or literally `"..%2Facme"` URL-decoded upstream) becomes `..--acme--pack` which is a valid dir name — OK — but `"./..` / `"...."` / backslashes on Windows pass through. A malicious `flint.config.yaml extends:` entry could be crafted to point outside the project root if the upstream loader interprets the returned path loosely.

`path.join(projectRoot, '.flint-packs', dirName)` is normally safe because `path.join` collapses `..`, but `dirName = '..foo'` does NOT traverse — so the concrete risk is low. Still, this is a trust-boundary function and should whitelist.

**Fix:** Reject refs matching `/[^a-zA-Z0-9_/-]/` with a clear error. Enforce `!ref.includes('..')` and `!ref.startsWith('/')`. Add a test file — there is currently a `registryResolver.test.ts` but it should explicitly cover these adversarial inputs.

### M7 — `ragRegistryService.setRegistryCache` uses module-level mutable state with no concurrency guard

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/ragRegistryService.ts` line 17

```ts
let registryCache: Record<string, ComponentEntry> = {};
```

Node is single-threaded per event loop, so this is safe for one process — but the MCP server handles parallel tool calls and the `setRegistryCache` / `queryRAGRegistry` race is real: during a re-index, a query can see a half-populated cache. There is no transaction, no generation number, no "loading" flag.

**Fix:** Rebuild into a local variable and atomically assign at the end of ingestion. Add a `generation` counter and include it in `RAGResult` so consumers can detect stale reads. Optional: wrap the cache in a `RegistryCache` class with a `snapshot()` method that returns an immutable view.

---

## MINOR findings

### m1 — Dead `_rawName` destructure in queryRegistry

`flint-mcp/src/core/registryService.ts` line 190: `const { name: _rawName, ...restRaw } = raw;` — the purpose is to force `name` to come from the map key, which is good defensive code, but the unused destructure triggers lint in strict projects. Prefer `const entry: ComponentEntry = { ...raw, name };`.

### m2 — Magic `50` limit cap

`flint-mcp/src/core/registryService.ts` line 200: `Math.min(limit, 50)`. Extract to a named constant `MAX_REGISTRY_RESULTS = 50` and export it for callers who want to know the ceiling.

### m3 — Shadow Storybook output is unvalidated markdown

`formatShadowStorybook` interpolates raw user-supplied strings (`entry.description`, `usageExample`, `compositionNotes`) into markdown without escaping pipe characters in table rows or backticks in inline code. A pathological description with `|` breaks the props table. Low risk, trivial fix: escape `|` → `\|` in props table cells.

### m4 — `tokenImporter.importFromJS` comment stripping is line-based and misses escaped newlines inside strings

`flint-mcp/src/core/tokenImporter.ts` lines 443–465: `stripLineComments` splits on `\n`, which means a backslash-continuation or a template literal spanning multiple lines loses its `in-string` state at each line boundary. This is a known limitation of regex-based JS parsing and is a reason to eventually reach for a real parser. For the current scope (W3C DTCG source files) it's fine — but add a test case with a multi-line string in a JS token file.

### m5 — `quoteUnquotedKeys` regex does not escape numeric-key dot notation

`flint-mcp/src/core/tokenImporter.ts` line 477: The key pattern `[0-9]+(?:\.[0-9]+)?` matches `1.5` as a key. Valid JS object keys cannot start with a digit unless quoted, and `1.5:` as a property key is a syntax error in source. The regex is permissive enough that it will quote `1.5:` silently and produce valid JSON, but the original source would have been invalid. Not a bug, but surprising.

### m6 — `componentClassification.STRICT_CLASSIFICATION_RULES` duplicates `ORDERED_SUBSTRING_KEYS`

The file maintains two parallel rule arrays (lines 136–194 and 211–226) with overlapping keywords and subtly different orderings (e.g. strict drops `navbar`, `header`, `footer`). This is a maintenance hazard — a future contributor will update one and not the other. Add an invariant test: every strict type appears in `ORDERED_SUBSTRING_KEYS` with the same keyword set.

### m7 — `seedFromProject` does not reindex on file change

`ragStore.ts` seeds at server startup. There is no fs.watch and no invalidation hook. A user editing `flint-manifest.json` at runtime must trigger `project:reindex` manually. The IPC exists (per `CLAUDE.md` CK.3 — "On-Demand Re-Indexing") but this file does not expose it — `seedFromProject` is the only entry point. Document the reindex-on-edit expectation in the service contract.

### m8 — `ComponentEntry.props` default type is `string` — numbers and booleans round-trip as strings

Lines 11–15: `default?: string` forces Shadow Storybook to render `default="false"` for a boolean prop instead of `{false}`. The example-generator already wraps boolean/number in curly braces (line 351), but the displayed default in the markdown table (line 248) still prints `"false"` as a string literal. Change to `default?: string | number | boolean`.

---

## Architecture observations (not findings, just notes)

1. **Two RAG implementations diverge.** Electron has `electron/ragService.ts` (transformer-based, per CLAUDE.md) and web has `server/services/ragStore.ts` (n-gram hashing). A user switching between Electron and web will get different search results for the same query. Consider a shared interface + pluggable embedder.

2. **`ragRegistryService` is a cache wrapper, but the web RAG path is separate.** There is no single "query the registry" function that unifies text-score (registryService) + vector-score (ragStore). `flint_query_registry` falls back to text only. The "semantic" differentiator is effectively inert until you ingest docs.

3. **`ComponentEntry` lives in `flint-mcp` but is re-declared in `server/services/ragStore.ts`.** Minor duplication. Export from `flint-mcp` and import — even across package boundaries it's cheaper than drift.

4. **No test for `flint_query_registry` happy path end-to-end.** `registryService.test.ts` tests the scoring function; there is no integration test that takes a manifest file + query string and asserts the Shadow Storybook output contains the expected component. Add one.

---

## Test Coverage Gaps (summary)

| Area | Current | Needed |
|------|---------|--------|
| `registryService.queryRegistry` | Present | + field-weighted scoring, + tie-breaking, + duplicate entry |
| `registryService.mergeTeamRegistryOverlay` | **None** | All branches: addEntries, importOverrides, deep-merge compositionRules, empty overlay, missing importPath error |
| `registryService.queryByFigmaId` | **None** | Match, no-match, multiple matches (returns first) |
| `registryService.queryRegistryDeterministic` | **None** | Figma-ID hit, Figma-ID miss falls to keyword, null ID goes straight to keyword |
| `componentClassification` | **None (no file)** | Full truth table; adversarial `table` / `form field` / `navbar-container` |
| `ragRegistryService` | **None** | set/get/clear/query round-trip, accumulation semantics |
| `ragStore.ts` (web) | **None** | Full contract: ingest, query, clear, count, seedFromProject with 3 sources, symlink skip, malformed files, empty-table guard, L2 normalization |
| `registryResolver` adversarial refs | Partial | Add `..`, backslash, absolute path, URL-encoded traversal cases |
| `tokenImporter` edge cases | Strong | + multi-line string in JS, + numeric-key rejection, + CSS at-rules |

---

## Recommended Priority Order

1. **C2 + C3** — Add the missing test files. This is the fastest way to raise the grade and lock in regressions before changing anything. (Half a day.)
2. **C4 + M6** — Validate trusted-input parameters (`componentType`, pack ref). Pure defensive guards, no design work. (1 hour each.)
3. **C5 + M1 + M2** — `ComponentEntry` schema evolution: deep-merge compositionRules, add `PropDefinition.description` / `translatesFrom`, field-weighted scoring. This is the "make the differentiator real" pass.
4. **C1** — Semantic vs lexical RAG. Decide now whether to ship a real embedding model or rebrand the feature as "keyword-weighted search". Either is honest; the current state is not.
5. **M3 + M7** — Multi-library conflict handling and cache concurrency. Required before shipping team overlays / multi-pack support.

---

## Verdict

**REVISE.** The contracts are right, the intent is right, the code is mostly correct in the narrow cases it handles — but the combination of (a) zero tests for the module that matches registry queries in the web build (`ragStore.ts`), (b) zero tests for the canonical classification table (`componentClassification.ts`), (c) zero tests for the team-overlay merge (`mergeTeamRegistryOverlay`), and (d) an "approximate semantic" path that is in fact lexical, means Flint cannot credibly claim RAG + constrained registry as a differentiator today.

None of this is expensive to fix. Three targeted test files and one honest doc update get this from B- to A- in a single session. The `PropDefinition` schema evolution and deep-merge work is the follow-on that unlocks rogue-intrinsic detection.

No TSC was run because this is a read-only review and none of the files were modified. Recommend running `cd flint-mcp && npx tsc --noEmit` and `cd flint-mcp && npm test` before implementing any of the fixes above, to establish a clean baseline.
