# AST Surgery Engine -- A+ Code Review

**Date:** 2026-04-10
**Reviewer:** Quality Gate (Opus 4.6)
**Scope:** Core mutation engine, recovery controller, MCP ast-modifier, orchestrator C15/C16, injectFlintIds, mutationValidation, layoutMapper
**TSC:** 0 errors

---

## Summary Table

| File | Grade | Blockers | Majors | Minors |
|------|-------|----------|--------|--------|
| `src/core/ASTService.ts` | **A-** | 0 | 1 | 2 |
| `src/core/recoveryController.ts` | **A** | 0 | 0 | 1 |
| `flint-mcp/src/core/ast-modifier.ts` | **A-** | 0 | 1 | 2 |
| `src/utils/astModifier.ts` | **A-** | 0 | 1 | 1 |
| `flint-mcp/src/core/injectFlintIds.ts` | **A** | 0 | 0 | 1 |
| `flint-mcp/src/core/mutationValidation.ts` | **A** | 0 | 0 | 2 |
| `electron/orchestrator.ts` (C15/C16 scope) | **A** | 0 | 0 | 1 |
| `src/utils/layoutMapper.ts` | **A+** | 0 | 0 | 0 |

**Overall: A-** -- Zero blockers. The engine is sound. Three MAJOR items deserve attention but none violate Commandments.

---

## Commandment Compliance

| Commandment | Verdict | Notes |
|-------------|---------|-------|
| **C3 (Fresh Parse)** | PASS | `applyMutationBatch` parses fresh at line 359, never touches store AST |
| **C7 (ID Preservation)** | PASS | `editorStore.applyBatch` calls `injectFlintIds` after structural ops (line 341). `astBufferStore.loadBuffer` injects on every load. |
| **C10 (Targeted Micro-Recovery)** | PASS | `nodeExists()` implemented and documented. `recoveryController` uses `applyInversions` which shortcuts to `restoreCode` for structural ops. |
| **C13 (No Regex Surgery)** | PASS | All mutations use Babel traverse/types. Zero `source.replace()` patterns. |
| **C15 (Granular AST Tools)** | PASS | Orchestrator defines exactly 15 granular tools. No raw code generation tool exists. MUTATION_TOOL_NAMES gated. |
| **C16 (In-Memory Validation)** | PASS | `validateToolInput` runs Babel parse + LSP check before every tool_call emission (line 1764-1766). |

---

## Per-File Findings

### src/core/ASTService.ts -- Grade: A-

**MAJOR-1: `window.flintAPI` call inside batch engine (line 419-421)**
The `deleteNode` case calls `window.flintAPI.tokens.clearOverride?.(mutation.nodeId)` directly inside `applyMutationBatch`. This is a side effect inside a function that should be pure (parse -> mutate -> generate). The `typeof window !== 'undefined'` guard saves it from crashing in tests, but the IPC call belongs in the caller (`editorStore.applyBatch` or the component that triggers the delete), not inside the batch engine.
- Classification: MAJOR (architectural anti-pattern -- Zustand store action calls this, so IPC leaks into the mutation path)
- Fix: Move the `clearOverride` call to the `deleteNode` handler in `editorStore.applyBatch` after the batch completes.

**MINOR-1: Exhaustive switch default uses `.type` instead of `.op` (line 458)**
```typescript
throw new Error(`Unhandled mutation type: ${(_exhaustive as any).type}`)
```
Should be `.op` to match the discriminant field. The error message would be misleading if it ever fired.

**MINOR-2: `applyInversions` casts inversions to `ASTMutation[]` (line 526)**
```typescript
const result = applyMutationBatch(currentCode, inversions as ASTMutation[])
```
This cast is safe because `UpdateClassNameMutation`, `UpdatePropMutation`, and `UpdateTextContentMutation` are shared between `ASTMutation` and `InverseMutation`, but it bypasses the type system. A dedicated `applyPropertyInversions` function would be cleaner.

### src/core/recoveryController.ts -- Grade: A

**MINOR-1: No zombie check before single-file undo (line 87)**
The docstring for `applyInversions` says "Callers should run `nodeExists()` on each flint ID before calling this to detect and block zombie-node undos." But `applySingleFileUndo` does not call `nodeExists()`. In practice this is safe because property inverses that target a missing node are no-ops, and structural inverses use `restoreCode` snapshots. But the contract is violated.
- Fix: Add a `nodeExists` pre-flight for property-only inversions, or update the docstring to reflect the actual contract.

### flint-mcp/src/core/ast-modifier.ts -- Grade: A-

**MAJOR-2: `moveNode` does not guard against ancestor-to-descendant moves**
If `sourceId` is an ancestor of `targetId` and position is `inside`, the source is removed from the tree (splicing it out of its parent), which also removes the target since it is a descendant. The subsequent `findNode` for `tgt` would have already returned before the splice, so `tgt.node` is stale. The result: the source node gets orphaned from the tree entirely.
- Classification: MAJOR (data loss on pathological input)
- Fix: After finding both nodes, walk up from `tgt` to check if `src.node` is an ancestor. Abort if so.

**MINOR-1: `stampFlintId` uses `Math.random()` (line 194)**
Not cryptographically important, but `Math.random().toString(36).slice(2, 9)` produces 7-char IDs with ~36^7 = ~78 billion values. Collision probability is negligible for typical file sizes, but `crypto.randomUUID()` would be more robust and available in Node.js.

**MINOR-2: Duplicate code between `src/utils/astModifier.ts` and `flint-mcp/src/core/ast-modifier.ts`**
Both files contain near-identical implementations of `moveNode`, `injectComponent`, `applyTokenFix`, `emitHook`, `emitHandler`, `emitCallback`, `emitConditional`, `emitMap`, and `composeSlot`. Any bug fix applied to one must be manually applied to the other. This is a maintenance risk.
- Fix: Extract shared AST mutation logic into a `shared/ast-ops/` package that both consume.

### src/utils/astModifier.ts -- Grade: A-

**MAJOR-3: Same ancestor-to-descendant move issue as MCP ast-modifier**
Identical to MAJOR-2 above. Both copies share the same bug.

**MINOR-1: Self-move guard is ID-only, not structural**
`sourceId === targetId` catches the trivial case, but if two different IDs resolve to the same AST node (structural ID and flint ID pointing to same element), the move would attempt to splice the node out of its own parent and re-insert it. The `findNode` calls would return the same `node` reference. The splice removes it, then the insert puts it back -- net no-op but wasteful. Low risk.

### flint-mcp/src/core/injectFlintIds.ts -- Grade: A

**MINOR-1: `@ts-ignore` on line 14 without explanation**
```typescript
// @ts-ignore -- CJS/ESM interop
```
The comment is terse. Per coding standards, `@ts-ignore` should explain why it is necessary. The CJS interop pattern is the same one used everywhere else (`(traverse as any).default || traverse`), which is fine, but the directive itself is unnecessary since the fallback pattern handles the type.

### flint-mcp/src/core/mutationValidation.ts -- Grade: A

**MINOR-1: Regex used to extract component name (line 33)**
```typescript
const match = snippet.match(/^<([A-Z][A-Za-z0-9.]*)/);
```
This is regex on a JSX snippet to extract a tag name, not regex surgery on source code. The comment at line 32 correctly notes this distinction. Acceptable per C13 since it is read-only extraction, not mutation. But using Babel parse would be more consistent.

**MINOR-2: Regex used to extract className (line 45)**
Same pattern -- read-only extraction from a snippet string. Not a C13 violation but worth noting for consistency.

### electron/orchestrator.ts (C15/C16 scope) -- Grade: A

**MINOR-1: `flint_add_class` and `flint_remove_class` are class-level convenience wrappers**
These two tools (lines 731-755) are essentially sugar over `flint_update_props` targeting `className`. Commandment 15 says "single-purpose mutation tools" which these are, but they increase the surface area the AI must reason about. Not a violation, just a design observation.

C15 compliance is strong: 15 tools total (7 structural + 4 CATALOG.1-3 + 2 class helpers + 2 audit readers), all granular and node-targeted. No raw code generation tool.

C16 compliance is strong: `validateToolInput` (line 1050+) runs synchronous Babel parse checks and async LSP validation for every structural tool before emission. Mithril pre-commit check (C17) blocks className mutations with color drift.

### src/utils/layoutMapper.ts -- Grade: A+

Clean, pure, well-typed. Mutually exclusive category sets are correct. No findings.

---

## Test Coverage Assessment

`src/core/ASTService.test.ts` covers:
- Empty batch, unparseable code, updateClassName, multi-mutation batch, nodeExists, applyInversions, synthesizeImports

Missing test coverage:
- `deleteNode` mutation op round-trip (forward + undo)
- `moveNode` mutation op round-trip
- `injectComponent` mutation op round-trip
- `applyTokenFix` mutation op round-trip
- `updateProp` with null (delete attribute)
- `updateTextContent` forward + undo
- CATALOG.1-3 stubs (emitHook, etc.) -- these are deferred stubs, but should still verify they produce `restoreCode` inversions
- Edge case: ancestor-to-descendant move (currently silently corrupts)

No test file found for `flint-mcp/src/core/__tests__/ast-modifier.test.ts`.

---

## Prioritized Punch List

| Priority | Item | Effort |
|----------|------|--------|
| 1 | MAJOR-2/3: Add ancestor-descendant guard to `moveNode` in both `src/utils/astModifier.ts` and `flint-mcp/src/core/ast-modifier.ts` | Small |
| 2 | MAJOR-1: Move `clearOverride` IPC call out of `applyMutationBatch` into caller | Small |
| 3 | Add `moveNode`, `deleteNode`, `injectComponent`, `applyTokenFix` round-trip tests to `ASTService.test.ts` | Medium |
| 4 | Create `flint-mcp/src/core/__tests__/ast-modifier.test.ts` with structural op tests | Medium |
| 5 | Fix `.type` to `.op` in exhaustive switch error message | Trivial |
| 6 | Consider extracting shared AST ops into a common package to eliminate duplication | Large (deferred) |
