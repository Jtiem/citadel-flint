# Contract Artifact: ARM.1 -- Armory Library Bootstrap

**Phase:** ARM.1
**Status:** APPROVED
**Author:** flint-architect
**Date:** 2026-04-16
**Citadel Components:** Armory (registry), Mason (D2C), Gate (export)

---

## Problem Statement

When `flint_set_library mui` is called, it seeds design tokens but NOT component entries. The Armory stays empty for MUI components. When Mason generates MUI code, `audit_ui_component` fires REG-001 ("Unregistered Component Usage") for every MUI primitive it used -- the system blocks output it just generated. This is the highest-priority onboarding friction point in the D2C pipeline.

---

## Solution

### Part A -- Library Primitive Auto-Seed

Add `getComponentManifest(): ComponentEntry[]` to the `LibraryAdapter` interface. Each adapter returns a static, bundled list of the library's primary component exports with `source: 'library'`. The `handleSetLibrary()` function calls this after `adapter.seedTokens()`, merges results into the registry cache, and writes them under a `libraryComponents` key in `flint-manifest.json`. Seeding is idempotent (keyed by `name + source`, never overwrites `source: 'local'` entries).

### Part B -- REG-001 Scope Correction

Add `'library'` as a third value to `ComponentEntry.source` (currently `'local' | 'remote'`). Update `visitRegistryUsage` in `MithrilLinter.ts` to recognize `source === 'library'` entries as trusted. Library-trusted components pass silently; only genuinely unknown components trigger REG-001. Update the REG-001 error taxonomy entry to mention library trust.

---

## Impact Map

| File | Change Type | Owner Agent | Summary |
|------|-------------|-------------|---------|
| `flint-mcp/src/core/libraryAdapters/types.ts` | MODIFY | flint-ast-surgeon | Add `getComponentManifest()` to `LibraryAdapter` interface |
| `flint-mcp/src/core/registryService.ts` | MODIFY | flint-ast-surgeon | Add `'library'` to `ComponentEntry.source` union |
| `flint-mcp/src/core/libraryAdapters/muiAdapter.ts` | MODIFY | flint-ast-surgeon | Implement `getComponentManifest()` returning ~55 MUI entries |
| `flint-mcp/src/core/libraryAdapters/shadcnAdapter.ts` | MODIFY | flint-ast-surgeon | Implement `getComponentManifest()` returning shadcn entries |
| `flint-mcp/src/core/libraryAdapters/primeAdapter.ts` | MODIFY | flint-ast-surgeon | Implement `getComponentManifest()` returning PrimeNG entries |
| `flint-mcp/src/core/libraryAdapters/tailwindAdapter.ts` | MODIFY | flint-ast-surgeon | Implement `getComponentManifest()` returning empty array |
| `flint-mcp/src/tools/setLibrary.ts` | MODIFY | flint-ast-surgeon | Call `getComponentManifest()` and seed registry + manifest |
| `flint-mcp/src/core/MithrilLinter.ts` | MODIFY | flint-ast-surgeon | Skip REG-001 for `source === 'library'` entries |
| `flint-mcp/src/core/errorTaxonomy.ts` | MODIFY | flint-ast-surgeon | Update REG-001 explanation to mention library trust |

---

## TypeScript Type Contracts

### Modified: `ComponentEntry.source` (registryService.ts)

```typescript
// Before
source?: 'local' | 'remote'

// After
source?: 'local' | 'remote' | 'library'
```

### New: `LibraryAdapter.getComponentManifest()` (types.ts)

```typescript
interface LibraryAdapter {
  // ... existing methods ...

  /**
   * Return a static manifest of the library's primary component exports.
   * Each entry has source: 'library'. Used to seed the Armory when this
   * library is selected, preventing REG-001 false positives.
   * Pure function -- no I/O. Manifest data is static and bundled.
   */
  getComponentManifest(): ComponentEntry[]
}
```

### New: `RegistryComponentEntry` expansion (MithrilLinter.ts)

```typescript
// Before
export interface RegistryComponentEntry {
    importPath?: string
    [key: string]: unknown
}

// After -- the existing shape already supports `source` via index signature,
// but visitRegistryUsage must now read it explicitly:
//   const entry = registry[name]
//   if (entry?.source === 'library') return
```

### Modified: `SetLibraryResult` shape (setLibrary.ts response)

```typescript
// The text response now includes componentsSeeded count.
// No structural type change needed -- the response is already a text string.
// But the function now returns additional info:
//   "Component seeding: 55 library components registered"
```

---

## IPC Channels

None. This feature is entirely within the MCP engine process (`flint-mcp/`). No Electron IPC, no preload changes, no Glass UI changes.

---

## Store Contracts

None. No Zustand store changes. The registry cache is managed within `registryService.ts` (in-process memory).

---

## Component Contracts

None. No React component changes. REG-001 results simply stop appearing for library components.

---

## Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|---------------|
| 4 | Local-First Only | Yes | Manifests are static data bundled in the adapter. No network fetch. |
| 6 | The Gatekeeper Rule | Yes | Library entries are trusted -- they do not create false export blocks. |
| 9 | CIEDE2000 Delta-E Logic | No | Color logic unchanged. |
| 13 | Deterministic Surgery | Yes | No regex. Registry lookup is set/map membership check. |
| 15 | Granular AST Tools Only | No | No AST mutations involved. |
| 16 | In-Memory Validation | No | No AI output involved. |

---

## Test Boundaries

| # | Test | Location | Assertion |
|---|------|----------|-----------|
| 1 | MUI `getComponentManifest()` returns >= 55 entries | `libraryAdapters/__tests__/libraryAdapters.test.ts` | Each entry has `name`, `importPath`, `source: 'library'` |
| 2 | shadcn `getComponentManifest()` returns non-empty manifest | `libraryAdapters/__tests__/libraryAdapters.test.ts` | Count > 0, all `source === 'library'` |
| 3 | primeng `getComponentManifest()` returns non-empty manifest | `libraryAdapters/__tests__/libraryAdapters.test.ts` | Count > 0, all `source === 'library'` |
| 4 | tailwind `getComponentManifest()` returns empty array | `libraryAdapters/__tests__/libraryAdapters.test.ts` | Length === 0 |
| 5 | `flint_set_library mui` seeds Box into registry cache | `tools/__tests__/setLibrary.test.ts` (NEW) | Registry cache contains 'Box' after call |
| 6 | Seeding is idempotent (calling twice doesn't duplicate) | `tools/__tests__/setLibrary.test.ts` (NEW) | Count same after second call |
| 7 | Library entries do not overwrite local entries with same name | `tools/__tests__/setLibrary.test.ts` (NEW) | A local 'Box' survives MUI seeding |
| 8 | REG-001 does NOT fire for `source: 'library'` entries | `core/__tests__/MithrilLinter.test.ts` | Zero REG-001 warnings on MUI JSX when library registered |
| 9 | REG-001 DOES fire for unknown components even when library is set | `core/__tests__/MithrilLinter.test.ts` | `<MyUnknownWidget>` triggers REG-001 |
| 10 | REG-001 DOES fire when registry is empty (existing behavior) | `core/__tests__/MithrilLinter.test.ts` | Existing behavior preserved |

---

## Open Questions

1. **Should `flint_reindex_registry` also trigger library seeding?**
   Recommended: Yes. If `policy.json` has `selectedLibrary`, reindex should re-seed the library manifest to keep the registry consistent after a full reset. This is a follow-up task, not a blocker for ARM.1.

2. **Should library components appear in `flint_query_registry` results?**
   Recommended: Yes, with a `source` filter parameter. Library entries are useful for discoverability ("what MUI components can I use?"). Add `source?: 'local' | 'remote' | 'library'` filter to `flint_query_registry` as a follow-up.

3. **Tailwind scope:**
   Recommended: Empty array. Tailwind is utility-first with no PascalCase component exports. REG-001 is irrelevant for Tailwind projects. `getComponentManifest()` returns `[]`.

4. **MUI v5 vs v6 import paths:**
   Recommended: Target MUI v5 paths (`@mui/material/Box`), which are valid for both v5 and v6. A `libraryVersion` field is a future enhancement, not needed for ARM.1.

---

## Success Criteria

- [ ] `/figma` on any Figma frame generates MUI code with zero REG-001 violations
- [ ] `audit_ui_component` on MUI components returns only real governance issues
- [ ] `flint_set_library mui` takes <= 2 seconds and silently seeds tokens + components
- [ ] All 10 test boundaries pass
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Onboarding flow produces zero false-positive violations on a fresh MUI project

---

## Implementation Order

**Group A (parallel -- pure functions, no cross-file dependencies):**
- `types.ts` -- add `getComponentManifest()` to `LibraryAdapter` interface
- `registryService.ts` -- add `'library'` to `ComponentEntry.source` union
- `muiAdapter.ts` -- implement `getComponentManifest()` with ~55 entries
- `shadcnAdapter.ts` -- implement `getComponentManifest()`
- `primeAdapter.ts` -- implement `getComponentManifest()`
- `tailwindAdapter.ts` -- implement `getComponentManifest()` returning `[]`

**Group B (sequential -- depends on Group A types):**
- `setLibrary.ts` -- call `getComponentManifest()` and seed registry + manifest
- `MithrilLinter.ts` -- skip REG-001 for `source === 'library'` entries
- `errorTaxonomy.ts` -- update REG-001 explanation

**Owner:** All files are within `flint-mcp/` and owned by `flint-ast-surgeon`.

---

## Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Manifest list goes stale as MUI releases new components | Low | -- | Manifests are intentionally conservative (primary exports only). Users can enrich via `flint_add_remote_library` for missing components. |
| Library entries pollute `flint_query_registry` results | Low | -- | Follow-up: add `source` filter to query tool. |
| Idempotency bug causes duplicate registry entries | Medium | 6 | Test boundary #6 explicitly covers this. Key by `name + source`. |
| `visitRegistryUsage` already passes for any registry member | Low | -- | Current code at line 1342 already returns early if `registryNames.has(name)`. The fix ensures library entries ARE in the registry set, which is the real gap (they are not seeded today). |
