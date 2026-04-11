# Figma D2C Pipeline Review -- Mason/Scout/Sage Chain

**Reviewer:** Quality Gate (claude-opus-4-6)
**Date:** 2026-04-10
**Scope:** 9 files across flint-mcp/src/core and electron/ingestion

---

## Summary Table

| File | Grade | Critical | Major | Minor |
|------|-------|----------|-------|-------|
| `hydroPaste.ts` (Mason) | B+ | 0 | 1 | 2 |
| `figmaMcpParser.ts` | B | 0 | 2 | 1 |
| `figmaJsxTransformer.ts` | B+ | 0 | 1 | 2 |
| `d2cRefinement.ts` (Sage/Oracle) | A- | 0 | 1 | 1 |
| `figmaTokenExtractor.ts` (Scout) | A | 0 | 0 | 1 |
| `codeConnectMapper.ts` (Bridge) | A | 0 | 0 | 1 |
| `ingestion-server.ts` | B+ | 0 | 1 | 2 |
| `IngestionAuditor.ts` | A- | 0 | 0 | 2 |
| `normalizer.ts` | A | 0 | 0 | 1 |

**Overall Pipeline Grade: B+**

Zero critical findings. The pipeline is solid. Findings are quality improvements, not safety blockers.

---

## Per-File Analysis

### 1. `flint-mcp/src/core/hydroPaste.ts` -- Grade: B+

**MAJOR: No depth limit on recursive tree walk (line 590-598)**
`generateJSX` and `generateJSXWithEmitter` recurse into `node.children` with no max-depth guard. A deeply nested Figma tree (100+ levels) could blow the call stack.

Suggested fix: Add a `MAX_DEPTH = 50` constant and return an empty `<div />` placeholder when exceeded.

**MINOR: `as FigmaNode` casts without validation (line 793)**
`JSON.parse(figmaPayload) as FigmaNode` trusts the parsed object blindly. A type guard similar to normalizer.ts's `isFigmaVariablesPayload` would be safer.

**MINOR: `node.children![0]` non-null assertion (line 571, 651)**
`isLikelyButton` checks `children.length !== 1` but the call sites use `node.children!` with a non-null assertion. Safe in practice because `isLikelyButton` returns false when children is undefined, but the assertion obscures this.

**Commandment 13 (No Regex Surgery):** PASS. All JSX generation is string concatenation of known templates, not regex replacement of source code. Color resolution uses the lookup map. Acceptable.

**Commandment 2 (Token-Tied Styling):** PASS. All colors resolve through `resolveColorClass` which checks token lookup first, falls back to CIEDE2000 fuzzy matching, and only uses arbitrary values as a last resort. The fallback to `bg-[#hex]` is a correct degradation.

**Commandment 4 (Local-First):** PASS. No external URLs.

---

### 2. `flint-mcp/src/core/figmaMcpParser.ts` -- Grade: B

**MAJOR: Regex used to parse JSX (lines 104-131)**
`parseFigmaMcpResponse` uses regex to extract `data-node-id` and `data-name` attributes from raw JSX strings. This is input parsing (reading Figma MCP response), not source code modification, so it does not violate Commandment 13. However, it is fragile: a `data-node-id` value containing `"` or a multi-line element will break the regex.

Suggested fix: Parse with Babel (`@babel/parser`) and traverse the AST to extract data attributes. This is the same pattern `figmaJsxTransformer.ts` already uses, and it would be more robust.

**MAJOR: O(n*m) enrichment loop (lines 156-169)**
`enrichFigmaNodes` iterates all hints for every node ID, comparing normalized IDs. For a large tree (1000 nodes) with 500 hints, this is 500K comparisons. Should build a normalized-ID lookup map first.

**MINOR: Duplicated classification logic**
`classifyDataName` duplicates logic from `classifyComponent` in `hydroPaste.ts`. Consider importing from a shared module to prevent drift.

---

### 3. `flint-mcp/src/core/figmaJsxTransformer.ts` -- Grade: B+

**MAJOR: Duplicated classification map (lines 702-748)**
`classifyName()` is explicitly marked "same logic as figmaMcpParser but inline to avoid circular deps." This is the third copy of the same mapping (also in `hydroPaste.ts`'s `classifyComponent` and `figmaMcpParser.ts`'s `classifyDataName`). Three copies means three places where a new component type must be added.

Suggested fix: Extract to a shared `componentClassification.ts` module. Circular dep avoidance is a valid concern but can be resolved with a leaf module that imports nothing from the engine.

**MINOR: `mapClassTokens` uses regex on className strings (lines 492-542)**
The regex replacements in `mapClassTokens` operate on className string values (not source code), which is acceptable under Commandment 13. The className is extracted from the Babel AST, manipulated, then written back. This is the correct pattern.

**MINOR: `inferInputTextRole` uses hardcoded hex values (lines 779-783)**
Hex values like `#71717a`, `#09090b` are hardcoded to detect muted vs foreground colors. These should be resolved through the design token system instead of comparing against magic hex values.

**Commandment 13:** PASS. The `code.replace` on line 1818 operates on Babel-generated output to strip the wrapper function, not on user source code.

---

### 4. `flint-mcp/src/core/d2cRefinement.ts` (Sage/Oracle) -- Grade: A-

**MAJOR: Raw `fetch` to external API without offline fallback path documentation**
Lines 130 and 304 make `fetch` calls to `https://api.anthropic.com/v1/messages`. This is the only file in the pipeline that reaches out to an external URL. This does NOT violate Commandment 4 (which governs preview URLs, not API calls), and the graceful fallback behavior is well-implemented (returns original scaffold on any failure). However, the direct `fetch` bypasses any future proxy/rate-limit infrastructure.

**MINOR: `jsonMatch` regex for AI response extraction (line 166)**
`text.match(/\{[\s\S]*\}/)` is greedy and will match the largest possible JSON-like substring. If the AI returns multiple JSON blocks, this could capture garbage. Use a proper JSON extraction approach or at least use a non-greedy match.

**Commandment 16 (In-Memory Validation):** PASS. Line 356 validates AI-refined code via Babel parse before accepting it. Exemplary implementation.

---

### 5. `flint-mcp/src/core/figmaTokenExtractor.ts` (Scout) -- Grade: A

**MINOR: `castNode` uses `as FigmaNode` without structural validation (line 262)**
Only checks `typeof raw !== 'object'`. Could silently process a non-Figma object. Low risk since callers control the input.

**Commandment 9 (CIEDE2000):** PASS. Uses `deltaE2000` from `colorMath.js` for near-match detection at threshold 2.0.

**Commandment 2 (Token-Tied):** PASS. Proposes tokens, never auto-applies. Clean separation of extraction from application.

Excellent module. Pure, stateless, well-typed, thorough edge case handling.

---

### 6. `flint-mcp/src/core/codeConnectMapper.ts` (Bridge) -- Grade: A

**MINOR: Static mapping data embedded in source code**
The 37 component mappings across 3 libraries are hardcoded. As libraries evolve, this will need manual updates. A JSON/YAML config file loaded at runtime would be more maintainable, but the current approach is simpler and fully offline.

Clean, pure module. No I/O, no side effects, good null handling.

---

### 7. `electron/ingestion-server.ts` -- Grade: B+

**MAJOR: `extractIds` uses `any` type (line 349)**
```typescript
const extractIds = (node: any) => {
```
This is the only `any` in the pipeline. Should use a minimal structural type.

**MINOR: `figma-asset-received` IPC channel not using `ipcChannel()` helper (line 277)**
All other IPC sends use `ipcChannel(...)` but line 277 sends on a raw `'figma-asset-received'` string. This breaks the naming convention and could cause mismatches.

**MINOR: `CREATE TABLE IF NOT EXISTS` in request handler (line 365)**
Schema creation should happen at startup, not on every request. While SQLite handles this idempotently, it is wasted work.

**Commandment 12 (Atomic Queuing):** N/A for this file. Token writes go through prepared statements with a transaction wrapper, which is correct for SQLite.

---

### 8. `electron/ingestion/IngestionAuditor.ts` -- Grade: A-

**MINOR: Inlined CIEDE2000 implementation (lines 86-214)**
The deltaE2000 math is copy-pasted from `MithrilLinter.ts`. Comment on line 83 says "Kept in sync with..." but there is no mechanism to enforce sync. If one copy gets a bug fix, the others may not.

Suggested fix: Extract to a shared `electron/colorMath.ts` module. The current duplication exists because the ingestion auditor runs in electron/ and cannot import from flint-mcp/. A local shared module within electron/ would resolve this.

**MINOR: `findArbitraryValues` uses regex on className strings (line 532)**
Same pattern as figmaJsxTransformer -- regex on extracted className values, not on source code. Comment on line 527 explicitly documents Commandment 13 compliance. Correct.

**Commandment 13:** PASS. The heal function uses Babel AST traversal to find className attributes, then applies `findArbitraryValues()` to the string values. The tier-1 fix replaces the StringLiteral value via Babel node mutation, not regex on source.

---

### 9. `electron/normalizer.ts` -- Grade: A

**MINOR: Typo in function name (line 153)**
`resolveModeNme` should be `resolveModeName`.

Excellent module. Strong type guards, exhaustive switch on `FigmaVariableType`, clean separation of concerns. The type guard on line 69 is a model pattern for other files in this pipeline.

---

## Commandment Compliance Summary

| Commandment | Verdict | Notes |
|-------------|---------|-------|
| C2 (No Hallucinated Styling) | PASS | All color resolution goes through token lookup with CIEDE2000 fallback |
| C4 (Local-First Only) | PASS | d2cRefinement.ts calls Anthropic API but this is classification, not preview |
| C9 (CIEDE2000) | PASS | All color distance comparisons use deltaE2000, threshold 2.0 |
| C13 (No Regex Surgery) | PASS | Regex is used on extracted className values and on Figma MCP response parsing, never on source code |
| C16 (In-Memory Validation) | PASS | d2cRefinement.ts validates AI output via Babel parse before accepting |

---

## Prioritized Punch List

1. **Extract shared component classification module** -- Three copies of the same name-to-type mapping across hydroPaste, figmaMcpParser, and figmaJsxTransformer. High drift risk. (MAJOR)
2. **Add max-depth guard to recursive tree walkers** -- hydroPaste.ts generateJSX/generateJSXWithEmitter have no depth limit. (MAJOR)
3. **Fix `any` type in ingestion-server.ts extractIds** -- Only untyped code in the pipeline. (MAJOR)
4. **Build normalized-ID lookup map in figmaMcpParser enrichFigmaNodes** -- O(n*m) loop is avoidable. (MAJOR)
5. **Parse Figma MCP JSX with Babel instead of regex** -- figmaMcpParser.ts regex parsing is fragile. (MAJOR)
6. **Extract CIEDE2000 to shared electron/colorMath module** -- Eliminate copy-paste drift risk. (MINOR)
7. **Fix `figma-asset-received` IPC channel to use ipcChannel()** -- Naming convention violation. (MINOR)
8. **Fix `resolveModeNme` typo in normalizer.ts** -- Cosmetic but confusing. (MINOR)
9. **Remove hardcoded hex values from inferInputTextRole** -- Should use token system. (MINOR)
10. **Move schema creation out of request handler** -- ingestion-server.ts CREATE TABLE on every request. (MINOR)
