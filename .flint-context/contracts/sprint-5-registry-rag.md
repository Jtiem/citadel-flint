# Sprint 5 — Component Registry + RAG (A+ Sweep)

**Phase:** sprint-5-registry-rag
**Status:** DRAFT
**Owner:** flint-architect
**Date:** 2026-04-15
**Branch:** `fix/sprint-5-registry-rag`
**Review source:** `.flint-context/reviews/registry-rag-aplus-review-2026-04-12.md`
**Work queue:** `docs/strategy/Unified_A+_Sweep_Complete_Work_Queue.md` lines 173-199

---

## Decisions Log (2026-04-15)

1. **RAG rebrand = honesty pass only** — Justin pre-approved Option A earlier in session: rebrand `ragStore.ts` from "semantic search" to "keyword + n-gram similarity". **Do NOT wire ONNX / MiniLM** — that is a separate future sprint. This is a pure labeling fix: comments, JSDoc, file header, log prefixes, MCP warning strings. The `embedText` FNV-1a n-gram implementation stays exactly as-is.
2. **CRITs and MAJORs** follow the review verbatim — no scope negotiation needed, all 5 CRITs and 4 MAJORs are in scope.
3. **`PropDefinition` extension is additive** — every new field is `?:` optional, so existing manifests (75 entries in `flint-manifest.json`, 12 in `demos/flint-manifest.json`, 0 missing `importPath`) continue to type-check with zero changes.
4. **`importPath` required** — review says "require `importPath` when adding a net-new entry and throw on missing". Grep confirms **zero** existing manifest entries are missing `importPath`, so enforcing the runtime guard on `mergeTeamRegistryOverlay` cannot break existing data.
5. **`sourceId` tagging is additive** — new optional `sourceId?: string` field on `ComponentEntry`, plus a governance warning when `setRegistryCache` would overwrite a different-sourceId entry.
6. **`registryResolver` sandbox reuses the config-loader pattern** — reference implementation at `flint-mcp/src/core/config-loader.ts` (`resolveExtendsRef`). Same approach: reject `..`, backslash, absolute paths; normalize + boundary check.

---

## Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `flint-mcp/src/core/componentClassification.ts` | MODIFY | coder | CRIT C4: validate `componentType` param against `STRICT_COMPONENT_TYPES` before early return |
| `flint-mcp/src/core/registryService.ts` | MODIFY | coder | CRIT C5 (deep-merge + require importPath) + MAJOR M1 (field-weighted scoring) + MAJOR M2 (PropDefinition extension) + MAJOR M3 (sourceId tagging) |
| `flint-mcp/src/core/ragRegistryService.ts` | MODIFY | coder | MAJOR M7: atomic cache rebuild + generation counter |
| `server/services/ragStore.ts` | MODIFY | coder | CRIT C1 (rebrand semantic→lexical) + MAJOR M4 (collapse docs sources) + MAJOR M5 (clamp limit) |
| `flint-mcp/src/core/registryResolver.ts` | MODIFY | coder | MAJOR M6: path-traversal sandbox (reject `..`, `\`, absolute paths) |
| `flint-mcp/src/server.ts` | MODIFY | coder | String update: rebrand "Semantic search unavailable" warning string at line 2573 (carried with the CRIT C1 rebrand) |
| `flint-mcp/src/core/__tests__/componentClassification.test.ts` | CREATE | flint-test-writer | Full rule truth table (C3) |
| `server/services/__tests__/ragStore.test.ts` | CREATE | flint-test-writer | Ingest/query round-trip, empty table, seedFromProject (C2) |
| `flint-mcp/src/core/__tests__/registryOverlay.test.ts` | CREATE | flint-test-writer | Team overlay merge incl. deep-merge compositionRules (C5) |
| `flint-mcp/src/core/__tests__/ragRegistryService.test.ts` | CREATE | flint-test-writer | Atomic rebuild, generation counter, cache consistency (M7) |

---

## Per-File Defect Specifications

### 1. `flint-mcp/src/core/componentClassification.ts` — CRIT C4

**Review finding (verbatim):**
> "This is a `as ComponentType` cast with no validation. Any upstream caller... can pass `componentType: "widget"` or `"button"`... and produce an invalid classification that downstream emitters will either crash on or silently misroute."

**Exact change:** In `classifyComponentName` (lines 237-241), gate the early return on `STRICT_COMPONENT_TYPES.has(componentType)`. If the hint is not in the strict set, fall through to keyword classification and `console.warn` that the hint was ignored.

**Acceptance criteria:**
- `classifyComponentName('foo', 'button')` returns `null` or keyword-fallback result (NOT `{ type: 'button' }`) because `'button'` is in `DataNameType` but NOT in `STRICT_COMPONENT_TYPES`.
- `classifyComponentName('anything', 'widget')` falls through to keyword classification with a warning logged.
- `classifyComponentName('foo', 'input')` still returns `{ type: 'input', matchedKeywords: ['data-name:input'] }` (happy path preserved).
- Existing callers in `hydroPaste.ts`, `figmaMcpParser.ts`, `figmaJsxTransformer.ts` continue to work.

---

### 2. `flint-mcp/src/core/registryService.ts`

#### 2a. CRIT C5a — Deep-merge `compositionRules` in `mergeTeamRegistryOverlay`

**Review finding (verbatim):**
> "Line 80: `...prev, ...entry` is a **shallow** merge. If the overlay provides `compositionRules: { allowedChildren: ['X'] }`, it **replaces** the base's `compositionRules` entirely, dropping `forbiddenChildren` / `maxDepth` / `requiredParent`."

**Exact change:** In `mergeTeamRegistryOverlay` lines 75-85, replace the shallow spread with an explicit deep-merge for `compositionRules` (field-by-field: `allowedChildren`, `forbiddenChildren`, `requiredParent`, `maxDepth`). `props` and `tokens` stay shallow (field-by-field replacement is correct semantics — overlay replaces the whole prop definition, not sub-fields).

**Acceptance criteria:**
- Base has `compositionRules: { allowedChildren: ['A'], maxDepth: 3 }`, overlay has `compositionRules: { forbiddenChildren: ['B'] }` → result has all three fields `{ allowedChildren: ['A'], forbiddenChildren: ['B'], maxDepth: 3 }`.
- Overlay can explicitly override a single field (e.g. `allowedChildren: ['C']` replaces `['A']`).
- When overlay omits `compositionRules`, base value is preserved unchanged.

#### 2b. CRIT C5b — Require `importPath` for new entries

**Review finding (verbatim):**
> "Line 82: `importPath: entry.importPath ?? prev.importPath ?? ''` silently produces an empty string when neither side sets it."

**Exact change:** When `prev` is empty (`Object.keys(prev).length === 0`, i.e. net-new entry) and `entry.importPath` is missing/empty, throw a clear `Error`: `Team overlay addEntries["${name}"] is missing required "importPath"`.

**Acceptance criteria:**
- Adding a new entry with no `importPath` throws.
- Adding a new entry WITH `importPath` succeeds.
- Updating an EXISTING entry without providing `importPath` still works (falls through to `prev.importPath`).
- Test proves the error message format.

#### 2c. MAJOR M1 — Field-weighted scoring

**Exact change:** Replace `scoreComponent` with a field-weighted version:
- `name` match: +5
- `description` match: +3
- `variants` match: +2
- `tokens` match: +1
- `compositionNotes` / `a11yNotes` / `relatedComponents` match: +1
- Track frequency per word per field; no `break` after first field hit.
- Tie-break alphabetically by `name`.

**Acceptance criteria:**
- A component whose `name` contains the query scores strictly higher than a component where the query only appears in `compositionNotes`.
- Deterministic ordering on ties (alphabetic by `name`).
- Single-word query scoring: `nameMatch > descMatch > variantMatch > tokenMatch > notesMatch`.

#### 2d. MAJOR M2 — Extend `PropDefinition`

**Exact change:**
```ts
export interface PropDefinition {
    type: string;
    required: boolean;
    default?: string;
    description?: string;
    enum?: string[];
    deprecated?: boolean;
    /** Native HTML attribute this prop replaces (for rogue-intrinsic remediation). */
    translatesFrom?: string;
}
```

All new fields optional → 100% backwards compatible.

**Shadow Storybook formatter update:** When a prop has `description`, append it as a new column or a footnote row in the props table (architect decision: keep table 4-column, add a "Notes" paragraph below the table listing `<prop>: description`). When `deprecated: true`, render the prop name with strikethrough: `~~propName~~`. When `enum` present, render type cell as `"a" | "b" | "c"` instead of the raw type string.

**Acceptance criteria:**
- Existing manifests parse without error.
- Shadow Storybook renders new fields when present.
- `translatesFrom` is preserved through `mergeTeamRegistryOverlay`.

#### 2e. MAJOR M3 — `sourceId` tagging for multi-library conflict detection

**Exact change:**
- Add `sourceId?: string` to `ComponentEntry` (e.g. `'local-manifest'`, `'remote:shadcn'`, `'team-overlay'`).
- `mergeTeamRegistryOverlay` sets `sourceId: 'team-overlay'` on any addEntries.
- Introduce a helper `detectRegistryConflicts(existing, incoming): ConflictReport` that returns `{ name, existingSourceId, incomingSourceId }[]` for any key that would overwrite a different-sourceId entry. (No throwing — just a pure reporter; the `ragRegistryService` merge path will call it and log.)

**Acceptance criteria:**
- Test: two libraries contributing the same component name produce a conflict report.
- Test: same-sourceId overwrites produce no conflict.
- `sourceId` is not required on base entries (optional, unset on legacy manifests).

---

### 3. `flint-mcp/src/core/ragRegistryService.ts` — MAJOR M7

**Review finding (verbatim):**
> "During a re-index, a query can see a half-populated cache. There is no transaction, no generation number, no 'loading' flag."

**Exact change:**
- Replace the module-level `let registryCache` with a `RegistryCacheState` object: `{ entries, generation }`.
- `setRegistryCache(components)` builds a new object in a local variable, merges with existing, then atomically assigns to the module-level pointer and increments `generation`.
- Export `getRegistryGeneration(): number` for consumers that want to detect staleness.
- Call `detectRegistryConflicts` during merge and `console.warn` any conflicts.
- `queryRAGRegistry` result type extended with `generation` field (optional, for callers; backwards compatible because it returns `ComponentEntry[]`).

**Acceptance criteria:**
- Test: `setRegistryCache` called twice with overlapping keys produces monotonically increasing generation.
- Test: during an in-flight merge, `getRegistryCache()` never returns a half-populated state (simulated by reading pointer before/after assignment).
- Test: `clearRegistryCache()` bumps generation.
- No behavioral regression — `queryRAGRegistry` signature unchanged.

---

### 4. `server/services/ragStore.ts`

#### 4a. CRIT C1 — Rebrand "semantic search" → "keyword + n-gram similarity"

**Scope of rebrand (exhaustive — every public-facing string):**

| Location | Before | After |
|----------|--------|-------|
| `server/services/ragStore.ts:17` (file header) | "approximate semantic matching" | "keyword + n-gram similarity matching" |
| `server/services/ragStore.ts:9` (header) | (existing wording about transformer pipeline) | preserve, but add: "This is a **lexical** matcher, not a neural embedding. It scores on shared character n-grams and word unigrams — it will NOT match semantically equivalent phrases like 'button' ↔ 'action trigger'." |
| `flint-mcp/src/server.ts:2573` | `"Semantic search unavailable — results are from keyword matching only. Run flint_reindex_registry to restore full search."` | `"Lexical registry search unavailable — falling back to manifest keyword scoring. Run flint_reindex_registry to restore the n-gram index."` |
| `flint-mcp/src/server.ts:2533, 2537, 2542` (schema field `semantic_query`) | **KEEP** — this is a backwards-compatible parameter alias accepted from callers. Do NOT rename; deprecating a tool input is a breaking API change. Add a comment noting it is a legacy alias for `query`. |

**Function/type renames:** None required. The `RAGService` interface, `createRAGService`, `embedText`, `query`, etc. are all neutral names. The word "semantic" appears only in **comments, log strings, and the one MCP warning**.

**Consumer sweep result:**
- `electron/store.ts:214` — comment about "semantic search over design system docs" — also update to "lexical search" for consistency (this is the Electron side and adjacent to the same subsystem).
- `electron/ragService.ts:10` — comment says "queryRAG() for semantic search". This is the **Electron transformer-backed implementation** which IS a real neural embedding. **Leave unchanged** — this one actually IS semantic. The rebrand is specifically for the web (`ragStore.ts`) n-gram path.
- `.claude/skills/.../performance.json:79` — a metrics counter key `semanticSearches`. Out of scope (tool metadata for another tool).
- No Glass UI strings or sidebar tabs labeled "Semantic Search" exist (sweep across `src/`).
- No other MCP tool descriptions reference "semantic search".

**Total source-code strings to update: 3** (`ragStore.ts` header comment, `server.ts:2573` warning, `electron/store.ts:214` comment).

**Acceptance criteria:**
- Grep `rg "semantic search" server/ src/` returns zero hits after the change.
- Grep `rg "semantic" server/services/ragStore.ts` returns zero hits.
- Existing `semantic_query` parameter alias on `flint_query_registry` still accepted (backwards-compat).
- `electron/ragService.ts` (the real transformer path) left unchanged.

#### 4b. MAJOR M4 — Collapse docs sources in summary

**Exact change:** In `seedFromProject` lines 475-495, instead of pushing one `sources` entry per doc file, collect a count and push a single `'docs (N files)'` entry at the end. Per-chunk `source: 'docs/<filename>'` stays unchanged for attribution.

#### 4c. MAJOR M5 — Clamp `limit` to `[1, 100]`

**Exact change:** At the top of `query()` (line 300), clamp: `const k = Math.max(1, Math.min(limit, 100))` and use `k` in the `searchStmt.all(vecBuffer, k)` call.

---

### 5. `flint-mcp/src/core/registryResolver.ts` — MAJOR M6

**Review finding (verbatim):**
> "Reject refs matching `/[^a-zA-Z0-9_/-]/` with a clear error. Enforce `!ref.includes('..')` and `!ref.startsWith('/')`."

**Pattern reuse:** Follow the Sprint 3 `config-loader.ts` `resolveExtendsRef` sandbox pattern:
1. Validate input: reject `..`, backslash, leading `/`, any char outside `[a-zA-Z0-9_/-]`.
2. `path.normalize` the result.
3. `fs.realpathSync` after existence check to catch symlink escapes.
4. Boundary check: resolved path must start with `path.resolve(projectRoot, '.flint-packs')`.

**Exact change:** In `resolveRegistryRef` (lines 44-59), add input validation before `refToDirectoryName` and add the boundary check after the `existsSync` guard. Throw a clear Error with the invalid ref on validation failure.

**Acceptance criteria:**
- `resolveRegistryRef('../../etc/passwd', root)` throws.
- `resolveRegistryRef('acme\\pack', root)` throws.
- `resolveRegistryRef('/absolute/path', root)` throws.
- `resolveRegistryRef('acme/pack', root)` resolves correctly (happy path).
- Symlink escape via `.flint-packs/evil-link -> /etc` returns `null` (boundary check fails).

---

## New Test Files

### `flint-mcp/src/core/__tests__/componentClassification.test.ts`
Full truth table covering:
- Every keyword in `ORDERED_SUBSTRING_KEYS` (positive cases).
- Every rule in `STRICT_CLASSIFICATION_RULES` (positive cases).
- Adversarial negatives: `table` (must NOT match `tab`), `form field` (must NOT match `input` via substring since `field` is omitted), `profile-picture` (must NOT match — substring is `profile-pic`), `toggle-button` (ambiguity — test what wins), `navigation-bar` (`nav`), `hr` exact match.
- C4 regression: `classifyComponentName('foo', 'button')` does NOT return `{ type: 'button' }`.
- C4 regression: `classifyComponentName('foo', 'widget')` logs warning and falls through.
- Invariant: every type in `STRICT_COMPONENT_TYPES` is reachable via `classifyComponentName` with at least one input name.

### `server/services/__tests__/ragStore.test.ts`
- Happy path: ingest 3 chunks, query for substring, assert ordered results.
- Empty-table guard: query against 0-chunk store returns `[]` without throwing.
- Ingest round-trip: insert, count, query, clear, count.
- `seedFromProject` with manifest only, tokens only, docs only, all three.
- Symlink skip in `docs/` (create symlink, assert logged+skipped).
- Malformed `design-tokens.json` survives without throwing.
- M5 guard: `query('foo', 0)` clamps to 1, `query('foo', 999)` clamps to 100 (no throw).
- M4: `seedFromProject` with 5 doc files returns `sources` containing a single `'docs (5 files)'` entry, NOT 5 separate entries.

### `flint-mcp/src/core/__tests__/registryOverlay.test.ts`
- CRIT C5a: Base with `compositionRules: { allowedChildren, maxDepth }`, overlay with `{ forbiddenChildren }` → merged has all three.
- CRIT C5a: Overlay explicitly replacing `allowedChildren` works as expected.
- CRIT C5b: addEntries with missing `importPath` throws.
- CRIT C5b: addEntries WITH `importPath` succeeds.
- Updating existing entry without `importPath` inherits from `prev`.
- `importOverrides` applied after `addEntries`.
- Empty overlay returns a shallow copy (not same reference).
- `sourceId` stamped as `'team-overlay'` on addEntries.
- `detectRegistryConflicts` returns entries when same name maps to different sourceIds.

### `flint-mcp/src/core/__tests__/ragRegistryService.test.ts`
- `setRegistryCache` → `getRegistryGeneration()` increments monotonically.
- `clearRegistryCache()` bumps generation.
- `queryRAGRegistry` reads from cache and returns expected results.
- Merge semantics: two sequential `setRegistryCache` calls accumulate entries (existing behavior preserved).
- Conflict detection: setting a new source's version of an existing key logs a warning.
- Concurrency proxy test: simulate reading the cache pointer mid-merge (use a spy on the merge helper) and assert the reader never sees an empty intermediate state.

---

## Commandments Applied

- **C4 — Local-First Only:** `ragStore.ts` stays 100% offline — no network, no ONNX download. The rebrand is a labeling fix; no runtime behavior changes in the embedding path.
- **C14 — Bypass Prohibition:** `registryResolver.ts` uses `fs.existsSync` + `fs.realpathSync` which are read-only file system calls, consistent with the Sprint 3 `config-loader.ts` pattern. No writes, no git, no bypass of `FileTransactionManager`.

No mutation, write, or IPC boundary is crossed in this sprint — it is entirely a quality/correctness pass on existing pure modules.

---

## Work Partition & Parallelism Groups

| Group | Agent | Files | Notes |
|-------|-------|-------|-------|
| **A (parallel)** | coder #1 | `componentClassification.ts` | Pure — no shared state with other files |
| **A (parallel)** | coder #2 | `ragStore.ts` + `server.ts` (one string) + `electron/store.ts` (one comment) | Web build + MCP tool description rebrand. Grouped because C1 spans both. |
| **A (parallel)** | coder #3 | `registryResolver.ts` | Pure — isolated sandbox pass |
| **B (sequential, after A)** | coder #4 | `registryService.ts` | CRIT C5 + M1 + M2 + M3 all in one file — must serialize to avoid merge conflicts |
| **B (sequential, after registryService)** | coder #5 | `ragRegistryService.ts` | Depends on `ComponentEntry` / `detectRegistryConflicts` from registryService |
| **C (parallel with A+B)** | flint-test-writer | All 4 new test files | Test files import from finalized modules — writer can scaffold with `it.todo` against the contract types, then fill in assertions once implementation merges |

**Parallel group count: 3** (A with 3 independent subtasks, B sequential chain of 2, C parallel test-writer track).

---

## Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Rebrand accidentally removes the `semantic_query` legacy alias → breaks existing MCP callers | Medium | C14 (API stability) | Decision log item #1: explicitly preserve the parameter alias. Acceptance criteria checks it. |
| Field-weighted scoring changes ranking order → existing `registryService.test.ts` snapshots break | Medium | — | Existing tests asserting "best match first" should still pass because new weights only AMPLIFY the name>desc>notes order they already expect. If any snapshots break, update them as part of this sprint. |
| `PropDefinition` extension propagates to Glass UI types via `src/types/flint-api.d.ts` → type drift | Low | — | Grep shows `PropDefinition` is only re-declared in `electron/__tests__/reindex.test.ts` (test-local copy). No Glass UI import. Safe. |
| Deep-merge of `compositionRules` subtly changes merge semantics → any consumer relying on the replace-whole behavior breaks | Low | — | Review explicitly calls this out as a correctness bug, not a behavior to preserve. Current shallow-merge is the defect. |
| `detectRegistryConflicts` adds log noise for projects that legitimately use multiple source libraries | Low | — | Log at `console.warn` level, wrap in a once-per-conflict dedupe. Non-fatal. |
| `classifyComponentName` fallthrough-after-warning changes behavior for any upstream that relied on the "trusted" path to work with non-strict types | Medium | — | Grep callers in Phase 2. The three known callers (`hydroPaste`, `figmaMcpParser`, `figmaJsxTransformer`) use either strict types or omit `componentType`. Safe in principle; test during implementation. |
| Atomic cache rebuild + generation counter exposed via new `getRegistryGeneration()` → new public API surface | Low | — | Additive only. No existing consumer needs to call it. |

---

## Non-Goals

- **NOT** wiring ONNX / MiniLM / transformer embeddings into the web build. That is a separate future sprint.
- **NOT** unifying the Electron and web RAG implementations behind a single interface. Architecture observation only.
- **NOT** adding network registry resolution to `registryResolver.ts`. GPX.3 still deferred.
- **NOT** rewriting `tokenImporter.ts` (graded B+ in the review, out of scope).
- **NOT** exposing `detectRegistryConflicts` as a Glass UI surface. Logging only for this sprint.
- **NOT** changing the `flint_query_registry` tool's request schema or response shape.
