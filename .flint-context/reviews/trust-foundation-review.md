# Trust Foundation Review
**Date:** 2026-03-16
**Reviewer:** Agent 2 (Trust Foundation)
**Files reviewed:** electron/orchestrator.ts, src/core/ASTService.ts, src/utils/astModifier.ts, src/core/MithrilLinter.ts, src/core/A11yLinter.ts, flint-mcp/src/core/MithrilLinter.ts, flint-mcp/src/core/A11yLinter.ts, src/core/ASTService.test.ts

**TSC:** 0 errors
**Tests:** 411/411 passing

## Summary

The trust foundation is structurally sound for the Anthropic code path. The Flint Tool Catalog (Commandment 15) is enforced by schema design -- the LLM cannot emit raw code because no tool accepts raw source strings. Commandment 16 (in-memory validation) is enforced for all mutation tools before they reach the renderer. However, the OpenAI and Gemini provider branches bypass the entire tool catalog and validation pipeline, sending only text completions without any tool-use enforcement. The `applyMutationBatch` switch statement lacks a `default` clause with `never` assertion, which means a future `ASTMutation` variant could silently pass through without execution. Test coverage for `ASTService` is decent for happy paths but lacks adversarial failure cases.

## Findings

### CRITICAL: OpenAI and Gemini branches bypass Commandments 15 and 16

**File:** `electron/orchestrator.ts:862-902`
**Issue:** When `config.provider` is `'openai'` or `'gemini'`, the orchestrator creates a plain text-only chat stream. Neither provider branch passes `FLINT_TOOLS` to the API call, meaning the LLM responds with free-form text instead of structured tool calls. The `validateToolInput` function is never invoked on these paths. The entire safety architecture (tool catalog enforcement, Mithril pre-commit check, data-flint-id tampering guard, LSP validation) is bypassed.
**Commandment violated:** Commandment 15 (Granular AST Tools Only), Commandment 16 (In-Memory Validation)
**Impact:** An OpenAI or Gemini-configured instance can receive unvalidated, unconstrained AI output. If a downstream consumer attempts to parse the free-text response as operations, there is no structural guarantee the output conforms to the catalog. Even without direct execution, the system prompt instructs the AI to use tools that do not exist in the OpenAI/Gemini request schema, leading to confused output.
**Recommended fix approach:** Either (a) implement function-calling/tool-use for OpenAI and Gemini SDKs using their native equivalents, passing the same tool definitions and wiring the same `validateToolInput` gate, or (b) explicitly disable the mutation workflow for non-Anthropic providers and only allow read-only text responses, with a clear UI indicator that tool-use is Anthropic-only.
**Contract required:** yes

### HIGH: `applyMutationBatch` switch lacks `default` exhaustiveness assertion

**File:** `src/core/ASTService.ts:348-425`
**Issue:** The `switch (mutation.op)` statement handles all seven current op types but has no `default` case. If a new `ASTMutation` variant is added to the union (e.g., `wrapNode`), the switch will silently skip it at runtime -- no error, no warning, no inversion recorded. TypeScript's discriminated-union exhaustiveness checking cannot catch this without an explicit `default: { const _exhaustive: never = mutation; }` guard.
**Commandment violated:** none (process/safety concern)
**Impact:** A future mutation type would be silently dropped during batch execution. The user would see no error; the code would appear to apply successfully but the operation would not take effect. The inversion array would be incomplete, potentially corrupting undo/redo state.
**Recommended fix approach:** Add a `default` case containing `const _exhaustive: never = mutation; throw new Error("Unhandled mutation op: " + (mutation as ASTMutation).op)`. This produces a compile-time error when a new variant is added without a handler.
**Contract required:** no

### HIGH: `editorStore.applyBatch` does not call `injectFlintIds` after structural mutations

**File:** `src/store/editorStore.ts:306-337`
**Issue:** After `adapter.applyMutationBatch()` returns new code, `applyBatch` calls `adapter.parse(newCode)` to build a fresh AST and stores it in `editorStore.ast`. However, `injectFlintIds` is never called on this AST. For property-only mutations this is acceptable (existing IDs survive). For structural mutations (`moveNode`, `injectComponent`, `deleteNode`), newly created or repositioned nodes may lack stable `data-flint-id` attributes in the store's AST. The `LivePreview` independently calls `injectFlintIds` before rendering, so the iframe has correct IDs, but the `editorStore.ast` used by the Properties Panel, Layer Tree, and mutation targeting is potentially missing IDs on newly injected nodes until the next `setCode` or LivePreview refresh cycle.
**Commandment violated:** Commandment 7 (ID Preservation -- "injectFlintIds after every structural op")
**Impact:** Between a structural mutation and the next LivePreview render, properties panel interactions targeting the new node by flint ID will fail silently (no node match). The window is typically < 200ms in practice, but under slow rendering or rapid sequential mutations, the race is real.
**Recommended fix approach:** Call `adapter.injectFlintIds(newAst)` inside `applyBatch` after `adapter.parse(newCode)` returns a non-null AST, before storing it in state.
**Contract required:** no

### MEDIUM: Non-null assertions on optional ChatMessage fields without guards

**File:** `electron/orchestrator.ts:929-930, 950`
**Issue:** `m.toolUseId!` and `m.toolName!` are used without runtime validation. The `ChatMessage` interface defines these fields as optional (`toolUseId?: string`, `toolName?: string`). If a malformed message enters the history (e.g., a `tool_call` role message missing `toolUseId`), these assertions will produce `undefined` at runtime, which the Anthropic SDK will pass through as `id: undefined`, causing a silent API error or crash.
**Commandment violated:** none
**Impact:** A corrupt or incomplete conversation history causes a runtime crash in the Anthropic message builder.
**Recommended fix approach:** Add a guard clause that skips or throws on `tool_call` / `tool_result` messages that lack the required ID fields, before entering the message assembly loop.
**Contract required:** no

### MEDIUM: `applyTokenFix` modifies `attr.value.value` directly via string split/join

**File:** `src/utils/astModifier.ts:410-416`
**Issue:** `applyTokenFix` reads `attr.value.value` (a Babel StringLiteral's value field), splits it by whitespace, replaces the target class by index, and joins back. While this is technically operating on an AST node property (not source code), the operation is semantically equivalent to a search-and-replace on the className string. The function uses `classes.indexOf(hardcodedClass)` for exact match, which is safe. However, the split/rejoin pattern does not preserve original whitespace (e.g., if the author used double-spaces or newlines in className). This is a minor fidelity issue, not a Commandment 13 violation -- Babel's generator would normalize whitespace anyway.
**Commandment violated:** none (borderline Commandment 13 -- determined not a violation because it operates on AST node data, not source text)
**Impact:** Cosmetic: className whitespace may be normalized after a token fix. No functional impact.
**Recommended fix approach:** No action required. Document the whitespace normalization behavior.
**Contract required:** no

### MEDIUM: `deleteNode` in ASTService calls `window.flintAPI` inside a store-action code path

**File:** `src/core/ASTService.ts:402-404`
**Issue:** The `applyMutationBatch` function calls `window.flintAPI.tokens.clearOverride?.(mutation.nodeId)` when processing a `deleteNode` mutation. `applyMutationBatch` is a pure function in `src/core/` that is called from `editorStore.applyBatch`. This means a `window.flintAPI` IPC call fires from inside a Zustand store action's call chain. The CLAUDE.md explicitly states: "No `window.flintAPI` called inside a Zustand store action (belongs in hooks/components/services)."
**Commandment violated:** Anti-pattern: `window.flintAPI` in store action path
**Impact:** Couples the AST engine to IPC, breaking testability (the `typeof window !== 'undefined'` guard was added specifically because tests don't have `window`). The IPC call is fire-and-forget (`void`), so failure is silent.
**Recommended fix approach:** Move the `clearOverride` call out of `applyMutationBatch` and into `editorStore.applyBatch` after the mutation succeeds. The store action can inspect the mutations array for `deleteNode` ops and fire the cleanup call in the component/hook layer.
**Contract required:** no

### LOW: Complexity router uses regex on user message text

**File:** `electron/orchestrator.ts:144`
**Issue:** `countSentences` uses `msg.match(/[.!?](\s|$)/g)` to count sentence boundaries. This is regex on user chat text, not source code, so it is not a Commandment 13 violation. However, the pattern is fragile -- it counts "e.g." as two sentences and "U.S.A." as three, which could cause unnecessary model escalation.
**Commandment violated:** none
**Impact:** Over-escalation of complexity tier for messages containing abbreviations with periods. Results in using a more expensive model than needed.
**Recommended fix approach:** Use a sentence-splitting heuristic that excludes common abbreviations, or accept the current behavior as an intentional conservative bias.
**Contract required:** no

### LOW: `injectComponent` in astModifier uses `Math.random()` for flint ID generation

**File:** `src/utils/astModifier.ts:289`
**Issue:** `const flintId = Math.random().toString(36).slice(2, 9)` generates a 7-character random ID. `Math.random()` is not cryptographically secure, and the 7-character base-36 space (~78 billion values) is adequate for UI element IDs but the collision probability across large component trees is non-zero.
**Commandment violated:** none
**Impact:** Extremely low probability of flint ID collision. Not a security concern (IDs are not used for authentication).
**Recommended fix approach:** No immediate action. If deterministic test reproducibility is needed, consider injecting a seeded PRNG or using `crypto.randomUUID()`.
**Contract required:** no

## Clean / No Issue

- **Commandment 13 (No Regex Surgery):** All source code mutations in `ASTService.ts` and `astModifier.ts` go through Babel parse/traverse/generate. Zero `.replace()`, `.match()`, or `.exec()` calls on source code strings. The regex in `MithrilLinter.ts` operates on CSS class name strings extracted from AST nodes, not on source code. Clean.

- **Commandment 15 (AST Tool Catalog) for Anthropic path:** The `FLINT_TOOLS` array defines a closed set of 11 tools. No tool accepts a raw code string or full-file replacement payload. The LLM structurally cannot emit raw code. The `validateToolInput` function runs before any tool call reaches the renderer. Clean for the Anthropic branch.

- **Commandment 16 (TSC Loop) for Anthropic path:** `validateToolInput` is called on every `tool_use` block in `finalMsg.content` before emitting the `tool_call` chunk. Validation failures produce a `validation_error` chunk and trigger model escalation after 2 consecutive failures. Clean for the Anthropic branch.

- **Process Boundary:** `ASTService.ts`, `MithrilLinter.ts`, `A11yLinter.ts`, and `astModifier.ts` (all in `src/`) have zero Node.js imports. Clean.

- **MithrilLinter (both copies):** CIEDE2000 implementation is correct. The `cssColorToHex` parser handles hex, rgb, rgba, hsl, hsla. Severity bucketing at delta > 10 for critical is consistent between renderer and MCP copies. MCP copy adds `PolicyOptions` for configurable thresholds -- clean enhancement.

- **A11yLinter (renderer):** All 10 rules implemented. `hasTextChildren` correctly handles JSXText, JSXExpressionContainer, and nested JSXElement. `hasDynamicLabel` conservatively returns true for expression containers, preventing false positives. Clean.

- **A11yLinter (MCP):** Correctly delegates to the modular `a11y/runner.ts` engine while preserving the `audit()` backward-compatible API. Clean.

- **Error handling in orchestrator:** The outer `try/catch` in `sendChatMessage` catches Anthropic SDK errors (including network errors) and surfaces them via `onChunk({ type: 'error' })`. Clean.

- **Error handling in ASTService:** `parseCodeToAST` returns `null` on parse failure, and `applyMutationBatch` returns original code with empty inversions. Errors are not swallowed -- they propagate as `null` values that callers check. Clean.

## `as any` Inventory

No `as any` casts found in any of the reviewed files. All type casts use `as unknown` with explanatory comments.

| File | Line | Cast | Risk Level |
|------|------|------|------------|
| `electron/orchestrator.ts` | 939 | `as unknown as Anthropic.MessageParam['content'] & unknown[]` | Low -- documented SDK type workaround |
| `electron/orchestrator.ts` | 957 | `as unknown as Anthropic.MessageParam['content'] & unknown[]` | Low -- documented SDK type workaround |
| `src/core/ASTService.ts` | 42 | `as unknown as { default: typeof _traverse }` | Low -- standard CJS/ESM interop pattern |
| `src/utils/astModifier.ts` | 46 | `as unknown as { default: typeof _traverse }` | Low -- standard CJS/ESM interop pattern |
| `src/core/MithrilLinter.ts` | 40 | `as unknown as { default: typeof _traverse }` | Low -- standard CJS/ESM interop pattern |
| `flint-mcp/src/core/MithrilLinter.ts` | 31 | `as unknown as { default: typeof _traverse }` | Low -- standard CJS/ESM interop pattern |
| `flint-mcp/src/core/MithrilLinter.ts` | 88 | `rgb.map(srgbToLinear) as [number, number, number]` | Low -- array shape guaranteed by hexToRgb |

## Test Coverage Gaps

### Missing from ASTService.test.ts

1. **`injectComponent` round-trip test:** No test covers `op: 'injectComponent'` in `applyMutationBatch`. The mutation type is defined but never exercised in tests. Forward application, inverse snapshot, and flint ID stamping are all untested.

2. **`applyTokenFix` round-trip test:** No test covers `op: 'applyTokenFix'` in `applyMutationBatch`. The token substitution path, including the `split/indexOf/join` logic, is untested.

3. **`updateTextContent` round-trip test:** No test covers `op: 'updateTextContent'` in `applyMutationBatch`. The text replacement and inverse capture are untested.

4. **Malformed flint ID input:** No test passes a `nodeId` that matches no element (e.g., `"nonexistent-id"`) to verify the mutation is a safe no-op. The code handles this (traversal finds nothing), but there is no explicit test asserting the behavior.

5. **Multiple structural mutations in one batch:** No test applies two structural mutations (e.g., `moveNode` then `deleteNode`) in a single batch to verify that intermediate `generateCodeFromAST` snapshots for inversions are correctly ordered.

6. **Circular reference / self-move:** No test attempts `moveNode` where `sourceId === targetId` to verify the early return guard.

7. **Self-closing element injection:** No test attempts `injectComponent` targeting a self-closing element (e.g., `<img />`) to verify the silent abort path.

8. **`synthesizeImports` with namespace imports:** No test covers `import * as Icons from 'lucide-react'` style imports. The code handles namespace specifiers, but coverage is missing.

9. **`applyInversions` with mixed property and structural inverses:** No test covers the case where inversions array contains both `restoreCode` and `updateClassName` entries to verify that `restoreCode` wins.

10. **No assertion on generated code structure:** Most tests use `toContain` / `not.toContain` on the generated string. No test parses the output back to an AST and verifies structural properties (node count, tree depth, etc.).

## Backlog Items

Ordered by priority (CRITICAL first):

1. **[CRITICAL] Wire tool-use for OpenAI and Gemini providers** -- or disable mutation tools for non-Anthropic providers. The current state violates Commandments 15 and 16 for those code paths.

2. **[HIGH] Add `default: never` exhaustiveness guard** to the `applyMutationBatch` switch statement.

3. **[HIGH] Call `injectFlintIds` in `editorStore.applyBatch`** after `adapter.parse(newCode)` returns, before storing the AST in state.

4. **[MEDIUM] Move `window.flintAPI.tokens.clearOverride` out of `applyMutationBatch`** and into the `editorStore.applyBatch` or a post-batch hook.

5. **[MEDIUM] Add runtime guards for optional `toolUseId` / `toolName`** in the Anthropic message builder loop.

6. **[MEDIUM] Add test coverage for `injectComponent`, `applyTokenFix`, and `updateTextContent`** round-trips in ASTService.test.ts.

7. **[LOW] Add adversarial test cases** (nonexistent nodeId, self-move, self-closing target) to ASTService.test.ts.

8. **[LOW] Consider deterministic flint ID generation** in `injectComponent` for test reproducibility.
