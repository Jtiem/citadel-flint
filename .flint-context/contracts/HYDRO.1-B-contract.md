# Contract: HYDRO.1-B -- Figma ID Deterministic Match Loop

**Sprint:** HYDRO.1 -- Component Hydration Wiring
**Phase:** 1 (Contract)
**Date:** 2026-03-20
**Owner:** flint-mcp-specialist

---

## 1. Problem Statement

`queryRegistryDeterministic()` in `registryService.ts` exists and works (exact Figma ID match with keyword fallback), but it is never called from the ingestion pipeline. When a Figma payload arrives with a `figmaComponentId`, the system should look up the exact code component from `flint-manifest.json` and attach the matched component metadata to the generated output, instead of relying solely on heuristic name-based generation.

### Current state

- `hydroPaste.ts` lines 257-269: Already does an inline manifest scan for `figmaComponentId` matches. This is a partial implementation that duplicates the logic in `registryService.ts`.
- `registryService.ts` lines 39-67: `queryByFigmaId()` and `queryRegistryDeterministic()` are fully implemented but unused.
- `flint_ingest_figma` tool handler (via HYDRO.1-A): Will load manifest and tokens, then delegate to `HydroPasteEngine`.

### Decision: Where to call `queryRegistryDeterministic`

**In `HydroPasteEngine.processPayload()` inside `hydroPaste.ts`.**

Rationale: The engine already has access to the manifest (passed via constructor) and the Figma node (passed via `processPayload`). The inline manifest scan at lines 257-269 should be replaced with a call to `queryRegistryDeterministic()` from `registryService.ts`, which provides the canonical deterministic-then-heuristic lookup and returns a full `ComponentEntry` (with `importPath`, `props`, `tokens`, etc.) rather than just a name/path pair.

This is NOT done in `ingestion-server.ts` because:
- The ingestion server handles raw Figma Variables (POST /ingest), not component AST payloads.
- The ingestion server is an Electron main-process module; `registryService.ts` is a pure MCP module.

This is NOT done in `server.ts` tool handler because:
- The tool handler delegates to `HydroPasteEngine`. Splitting the lookup across two modules creates coupling.

---

## 2. Scope

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/core/hydroPaste.ts` | Import `queryRegistryDeterministic` and `ComponentEntry` from `registryService.ts`; replace inline manifest scan (lines 257-269) with `queryRegistryDeterministic` call; enrich `GeneratedComponent` output with matched component metadata | flint-mcp-specialist |

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `flint-mcp/src/core/__tests__/hydroPaste.test.ts` | Unit tests for `HydroPasteEngine` including deterministic match loop | flint-test-writer |

### Files UNCHANGED (verified)

| File | Why unchanged |
|------|---------------|
| `flint-mcp/src/core/registryService.ts` | `queryRegistryDeterministic` is already implemented and correct |
| `flint-mcp/src/tools/ingest.ts` | No changes needed here; HYDRO.1-A handles this file |
| `flint-mcp/src/server.ts` | The `hydrate_figma_data` handler already calls `HydroPasteEngine`; it will benefit from this change automatically |
| `electron/ingestion-server.ts` | Does not process component AST payloads |

---

## 3. Type Contracts

### New type: `RegistryMatch` (added to `hydroPaste.ts` or inlined)

Not a new exported type. The `ComponentEntry` from `registryService.ts` is the canonical shape. The `GeneratedComponent` interface gains one optional field:

```typescript
export interface GeneratedComponent {
    name: string;
    jsx: string;
    props: Record<string, string>;
    tokenRefs: string[];
    /** When a deterministic or heuristic registry match was found. */
    matchedComponent?: {
        importPath: string;
        matchMode: 'deterministic' | 'heuristic';
        figmaComponentId?: string;
        registryProps?: Record<string, { type: string; required: boolean; default?: string }>;
    };
}
```

### Modified `HydroResult` (no shape change -- just richer content)

The `HydroResult` interface is unchanged. The `summary` string will now include match mode information (already does in current code at line 300). The `components` array entries will have the new `matchedComponent` field populated when a match is found.

---

## 4. Behavioral Spec

### What MUST change in `HydroPasteEngine.processPayload()`

**Step 1: Import registry functions**

At the top of `hydroPaste.ts`, add:

```typescript
import { queryRegistryDeterministic, type ComponentEntry } from './registryService.js';
```

**Step 2: Build a `Record<string, ComponentEntry>` from the manifest**

The constructor already receives `manifest: Record<string, unknown>`. Extract the `components` sub-object and cast it:

```typescript
const components: Record<string, ComponentEntry> =
    (typeof this.manifest === 'object' && this.manifest !== null)
        ? ((this.manifest as any).components ?? {}) as Record<string, ComponentEntry>
        : {};
```

**Step 3: Replace the inline lookup (lines 257-269) with:**

```typescript
// FIGMA-MAP.3: Deterministic component lookup by Figma ID
let componentName = componentNameFromNode(payload);
let matchedEntry: ComponentEntry | null = null;
let matchMode: 'deterministic' | 'heuristic' | 'none' = 'none';

const registryResults = queryRegistryDeterministic(
    components,
    payload.figmaComponentId ?? null,
    componentName,
    1, // We only need the best match
);

if (registryResults.length > 0) {
    matchedEntry = registryResults[0];
    componentName = matchedEntry.name;
    matchMode = (matchedEntry.figmaComponentId === payload.figmaComponentId)
        ? 'deterministic'
        : 'heuristic';
}
```

**Step 4: Attach `matchedComponent` to the generated component**

After building the `GeneratedComponent` object, add:

```typescript
const generatedComponent: GeneratedComponent = {
    name: componentName,
    jsx,
    props: {},
    tokenRefs,
    ...(matchedEntry && {
        matchedComponent: {
            importPath: matchedEntry.importPath,
            matchMode,
            figmaComponentId: matchedEntry.figmaComponentId,
            registryProps: matchedEntry.props,
        },
    }),
};
```

**Step 5: Update imports array**

If `matchedEntry` has an `importPath`, prepend the import:

```typescript
const imports: string[] = ["import React from 'react';"];
if (matchedEntry?.importPath) {
    imports.push(`import { ${componentName} } from '${matchedEntry.importPath}';`);
}
```

**Step 6: Update summary string**

The summary already includes match mode at line 300. Ensure it references the new `matchMode` variable instead of the old `matchedImportPath` check:

```typescript
const matchDescription = matchMode === 'deterministic'
    ? 'deterministic (Figma ID)'
    : matchMode === 'heuristic'
        ? 'heuristic (name)'
        : 'none (new component)';
```

### What MUST NOT change

- The `HydroPasteEngine` constructor signature.
- The `HydroResult` interface structure (it gains richer content, not new fields).
- The `processPayload` parameter type (still `unknown`).
- The behavior when no Figma component ID is present and no heuristic match exists -- the engine must still generate a component from the raw Figma node.

---

## 5. Test Requirements

All tests go in `flint-mcp/src/core/__tests__/hydroPaste.test.ts`.

### Required test cases

| # | Test | Assertion |
|---|------|-----------|
| 1 | **Deterministic match: payload has figmaComponentId matching manifest** | `components[0].matchedComponent.matchMode === 'deterministic'`; component name matches manifest entry name |
| 2 | **Heuristic fallback: payload name matches a manifest component name** | `components[0].matchedComponent.matchMode === 'heuristic'`; `matchedComponent.importPath` is populated |
| 3 | **No match: unknown component generates fresh JSX** | `components[0].matchedComponent` is undefined; component name derived from Figma node name |
| 4 | **Import path from matched component** | `imports` array includes the import statement with the matched component's `importPath` |
| 5 | **Registry props attached to matched component** | `components[0].matchedComponent.registryProps` includes the props from the manifest |
| 6 | **Token mapping still works with deterministic match** | `tokenMappings` resolves fill colors to token classes regardless of match mode |
| 7 | **Empty manifest, valid payload** | Engine generates component from raw node; no crash |
| 8 | **Null figmaComponentId with valid name** | Falls through to heuristic search |
| 9 | **Summary string includes match mode** | `result.summary` contains 'deterministic' or 'heuristic' or 'none' as appropriate |

### Test setup

Tests instantiate `HydroPasteEngine` directly with mock manifest and token data. No filesystem mocking needed since the engine receives data via constructor.

```typescript
const manifest = {
    components: {
        'PrimaryButton': {
            name: 'PrimaryButton',
            importPath: '@/components/ui/PrimaryButton',
            figmaComponentId: 'figma:abc123',
            props: { variant: { type: 'string', required: false } },
        },
        'Card': {
            name: 'Card',
            importPath: '@/components/ui/Card',
            description: 'Container card',
        },
    },
};

const tokens = [
    { name: 'color.brand.primary', value: '#FF0000' },
    { name: 'color.surface', value: '#FFFFFF' },
];

const engine = new HydroPasteEngine(manifest, tokens);
```

### Validation commands

```bash
cd flint-mcp && npm test -- --reporter verbose 2>&1 | grep -E 'hydroPaste|PASS|FAIL'
npx tsc --noEmit
```

---

## 6. Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|-------------|---------|---------------|
| 2 | No Hallucinated Styling | Yes | Token mapping is preserved; deterministic match enriches output with known-good component metadata |
| 4 | Local-First Only | Yes | Registry lookup is in-memory against manifest data already loaded from disk |
| 9 | CIEDE2000 Delta-E | Indirect | Token color matching uses hex comparison; CIEDE2000 is enforced downstream by Mithril linter |
| 13 | Deterministic Surgery | Yes | No regex; `queryRegistryDeterministic` uses pure object iteration |

---

## 7. Dependency Map

```
HYDRO.1-B depends on:
  - registryService.ts (ONLINE, no changes needed)
  - hydroPaste.ts (the file this contract modifies)

HYDRO.1-B does NOT depend on HYDRO.1-A.
  - The engine is callable directly (as by hydrate_figma_data in server.ts).
  - HYDRO.1-A wires the tool handler; HYDRO.1-B improves the engine.

HYDRO.1-C does NOT depend on HYDRO.1-B.
  - Glass UI calls MCP tool; the tool calls the engine. Improvements here flow through automatically.
```

**Parallelism:** HYDRO.1-A and HYDRO.1-B can execute in parallel. They touch the same file (`hydroPaste.ts`) but in different ways:
- HYDRO.1-A only adds `export` keywords to existing interfaces (lines 11-23).
- HYDRO.1-B modifies the `processPayload` method body (lines 253-313) and the `GeneratedComponent` interface (lines 11-16).

To avoid conflicts, HYDRO.1-B should be the one that also exports the interfaces (combining the HYDRO.1-A export task into its changes to `hydroPaste.ts`). If running truly in parallel, coordinate via territory claim on `hydroPaste.ts`.

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `registryService.ts` imports in `hydroPaste.ts` create a new dependency edge | Low | Both are pure MCP modules with no Node.js-specific or Electron imports; the dependency is clean |
| Heuristic fallback may match the wrong component on ambiguous names | Medium | `queryRegistryDeterministic` always prefers exact ID match; heuristic is scored by word overlap. The caller (agent) reviews the generated code before committing |
| Adding `matchedComponent` to `GeneratedComponent` changes the JSON shape returned by `hydrate_figma_data` | Low | The field is optional; existing consumers that ignore unknown fields are unaffected. New consumers (HYDRO.1-C, agents) can use it |
| Test file `hydroPaste.test.ts` does not exist yet -- first test file for this module | Info | Standard test creation; no migration risk |
