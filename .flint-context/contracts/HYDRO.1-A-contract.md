# Contract: HYDRO.1-A -- Wire HydroPaste into flint_ingest_figma

**Sprint:** HYDRO.1 -- Component Hydration Wiring
**Phase:** 1 (Contract)
**Date:** 2026-03-20
**Owner:** flint-mcp-specialist

---

## 1. Scope

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/tools/ingest.ts` | Replace stub with full HydroPasteEngine integration | flint-mcp-specialist |
| `flint-mcp/src/core/hydroPaste.ts` | Export `HydroResult` and `GeneratedComponent` types for consumer use | flint-mcp-specialist |

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `flint-mcp/src/__tests__/ingestTool.test.ts` | Unit tests for `handleFlintIngest` | flint-test-writer |

---

## 2. Type Contracts

### Exported from `flint-mcp/src/core/hydroPaste.ts` (new exports)

The following types are already defined but not exported. They must be exported so `ingest.ts` can reference them in its return type:

```typescript
export interface GeneratedComponent {
    name: string;
    jsx: string;
    props: Record<string, string>;
    tokenRefs: string[];
}

export interface HydroResult {
    components: GeneratedComponent[];
    imports: string[];
    summary: string;
    tokenMappings: Record<string, string>;
}
```

No changes to the class or method signatures of `HydroPasteEngine`. It stays as-is.

### Modified in `flint-mcp/src/tools/ingest.ts`

Replace the current `IngestResult` with a richer shape that surfaces the full HydroPaste output:

```typescript
export interface IngestResult {
    status: 'ok' | 'no-tokens' | 'invalid-payload' | 'error';
    components: GeneratedComponent[];
    imports: string[];
    summary: string;
    tokenMappings: Record<string, string>;
    /** Non-null when status is 'error'. */
    error?: string;
}
```

The `IngestArgs` interface stays unchanged (already correct):

```typescript
export interface IngestArgs {
    figmaPayload: string;
    figmaUrl?: string;
    outputFormat?: 'jsx' | 'tsx' | 'vue';
    componentName?: string;
}
```

### Handler Signature (unchanged)

```typescript
export async function handleFlintIngest(
    args: IngestArgs,
    config: FlintConfig,
): Promise<IngestResult>
```

---

## 3. Behavioral Spec

### What the handler MUST do

1. **Resolve `projectRoot`** from `config.projectRoot` (same pattern as `handleFlintAudit` in `tools/audit.ts`).

2. **Load the manifest** from `path.join(projectRoot, 'flint-manifest.json')`. If the file does not exist, use `{ components: {}, resolvers: [] }` as the default. If the file exists but is unparseable, log the error and use the default.

3. **Load design tokens** from `path.join(projectRoot, '.flint', 'design-tokens.json')`. If the file does not exist or is unparseable, set `tokens` to `[]`.

4. **Check token availability**: If `tokens.length === 0`, return early with:
   ```typescript
   {
       status: 'no-tokens',
       components: [],
       imports: [],
       summary: 'No design tokens found. Import tokens via Figma sync or create them manually before ingesting components.',
       tokenMappings: {},
   }
   ```

5. **Instantiate `HydroPasteEngine`** with `(manifest, tokens)`.

6. **Call `engine.processPayload(args.figmaPayload)`**. The engine handles JSON parsing, error cases, and returns a `HydroResult`.

7. **Map the result** to `IngestResult`:
   - If `result.components.length === 0` and `result.summary` contains an error indicator (e.g., "Invalid JSON", "No payload", "Unrecognized"), set `status: 'invalid-payload'`.
   - Otherwise set `status: 'ok'`.

8. **Return the `IngestResult`**.

### What the handler MUST NOT do

- It must NOT perform its own JSON parsing of the figmaPayload. That is `HydroPasteEngine.processPayload`'s job.
- It must NOT import `fs` or `path` directly. These are imported via the existing pattern in `tools/audit.ts`: `import fs from 'node:fs'` and `import path from 'node:path'` at the module level.
- It must NOT write files to disk. The tool returns generated code; the caller (agent or Glass) decides what to do with it.

### Existing wiring in `server.ts` -- NO CHANGES NEEDED

The `flint_ingest_figma` case in `server.ts` (line 2171) already calls `handleFlintIngest(ingestArgs, flintConfig)` and serializes the result. No modification to `server.ts` is required. The improved `IngestResult` shape will flow through automatically.

---

## 4. Test Requirements

All tests go in `flint-mcp/src/__tests__/ingestTool.test.ts`.

### Required test cases

| # | Test | Assertion |
|---|------|-----------|
| 1 | **Happy path: valid Figma payload with tokens** | `status === 'ok'`, `components.length >= 1`, each component has `name`, `jsx`, `tokenRefs` |
| 2 | **No tokens file** | `status === 'no-tokens'`, `components` is empty, `summary` mentions tokens |
| 3 | **Malformed JSON payload** | `status === 'invalid-payload'`, `components` is empty, `summary` mentions "Invalid JSON" |
| 4 | **Empty/null figmaPayload string** | `status === 'invalid-payload'`, `components` is empty |
| 5 | **Token mappings resolve correctly** | Pass a payload with SOLID fill `{ r: 1, g: 0, b: 0 }` and a token with value `#FF0000`; verify `tokenMappings` maps the hex to the token class |
| 6 | **Manifest with matching Figma component ID** | Pass a manifest entry with `figmaComponentId: 'abc'` and a payload node with `figmaComponentId: 'abc'`; verify the component name matches the manifest entry name |
| 7 | **componentName override** | Pass `componentName: 'MyWidget'` in args; verify the generated component uses that name (this is a future enhancement -- the test should document the expected behavior even if `componentName` is not yet wired through `HydroPasteEngine`) |

### Test setup pattern

Tests must mock the filesystem (`fs.existsSync`, `fs.readFileSync`) to provide tokens and manifest data without touching disk. Use `vi.mock('node:fs')` with inline implementations. The config object is:

```typescript
const testConfig: FlintConfig = {
    projectRoot: '/tmp/test-project',
    // ... other fields from DEFAULT_CONFIG
}
```

### Validation commands

```bash
cd flint-mcp && npm test -- --reporter verbose 2>&1 | grep -E 'ingestTool|PASS|FAIL'
npx tsc --noEmit
```

---

## 5. Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|-------------|---------|---------------|
| 2 | No Hallucinated Styling | Yes | Token mappings tie fills to design tokens; unmapped fills produce `bg-[#HEX]` arbitrary values which the Mithril linter will flag downstream |
| 4 | Local-First Only | Yes | Reads from local filesystem only; no network calls |
| 12 | Atomic Queuing | N/A | This tool does not write to disk |
| 13 | Deterministic Surgery | N/A | No AST mutation in this tool -- it generates code strings |
| 15 | Granular AST Tools Only | N/A | This tool is a read/generate tool, not a mutation tool |
| 16 | In-Memory Validation | Future | The generated JSX should eventually pass through TSC before being surfaced, but that is the orchestrator's job, not this tool's |

---

## 6. Dependency Map

```
HYDRO.1-A has NO dependencies on HYDRO.1-B or HYDRO.1-C.
HYDRO.1-B depends on HYDRO.1-A being wired (so deterministic match can be tested end-to-end).
HYDRO.1-C depends on neither A nor B for its UI shell, but full functionality needs the MCP tool to work (A).
```

**Parallelism:** HYDRO.1-A and HYDRO.1-C can execute in parallel. HYDRO.1-B should start after HYDRO.1-A is merged or can run in parallel if it only touches `hydroPaste.ts` and `registryService.ts`.

---

## 7. Implementation Order

1. Export types from `hydroPaste.ts` (2 min, no logic change)
2. Rewrite `handleFlintIngest` in `tools/ingest.ts` (main work)
3. Write tests in `__tests__/ingestTool.test.ts`
4. Run `cd flint-mcp && npm test` -- confirm all 1886+ tests pass
5. Run `npx tsc --noEmit` -- confirm 0 errors

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `hydrate_figma_data` tool in server.ts does the same thing inline -- code duplication | Medium | After HYDRO.1-A ships, a follow-up task should refactor `hydrate_figma_data` to also call `handleFlintIngest` instead of duplicating the manifest/token loading logic |
| The `componentName` arg in `IngestArgs` is not wired through to `HydroPasteEngine.processPayload` | Low | Document as a known gap; the engine derives names from the Figma node. A future PR can add an override parameter to `processPayload` |
| No-tokens early return may surprise callers expecting partial results | Low | The summary message is explicit about what to do; callers can check `status` field |
