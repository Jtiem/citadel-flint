# D2C.5 -- AI Refinement Pass

**Phase:** D2C.5
**Status:** CONTRACT
**Author:** flint-architect
**Date:** 2026-03-26
**Depends on:** D2C.4 (Quality & Intelligence -- ONLINE), LIB.1 (Library Adapters -- ONLINE), Phase M (AI Orchestrator -- ONLINE)

---

## Architecture Decision: Option C -- Hybrid (Classification + Targeted Refinement)

### Why not pure Option A (post-scaffold rewrite)?

Option A sends the entire scaffold to an AI model and asks it to rewrite. This violates the spirit of Commandment 13 (Deterministic Surgery) by replacing a deterministic pipeline with a non-deterministic one. It also creates a large blast radius -- if the AI introduces a subtle error, the entire component is compromised. For a governance product, non-determinism at the component level is unacceptable as the default path.

### Why not pure Option B (classification map only)?

Option B is the safest approach but has a critical limitation: it only improves component *type* recognition. It cannot fix layout issues, add missing props, or restructure nesting. The ~25% gap is not just "wrong component type" -- it includes layout misinterpretation, missing interactive props, and structural nesting errors that classification alone cannot solve.

### Option C: The Hybrid

**Phase 1 -- AI Classification (always runs, fast, cheap):**
The AI analyzes the Figma node tree (structured JSON, not a screenshot) and produces a `ComponentClassificationMap` -- a set of overrides to the heuristic classifications. This is a structured JSON output, not code generation. The deterministic engine re-runs with these overrides applied. Cost: ~500 tokens in, ~200 tokens out. Latency: <2s with Haiku.

**Phase 2 -- Targeted Code Refinement (opt-in, per-component):**
For components where the classification confidence is low or the scaffold has known structural gaps (e.g., form layouts, complex card compositions), the user can request AI refinement of individual component scaffolds. The AI receives the single component's JSX (not the full page), the library idiom block, and the Figma subtree for that component. The output goes through the Commandment 16 TSC validation loop. If validation fails, the deterministic scaffold is preserved. Cost: ~2000 tokens per component. Latency: 3-8s with Sonnet.

This approach gives us:
- **Determinism by default** -- Phase 1 improves heuristics but the engine stays deterministic
- **Opt-in non-determinism** -- Phase 2 is user-triggered, per-component, with safe fallback
- **Minimal blast radius** -- AI never touches the full page; only one component at a time
- **Existing validation infrastructure** -- Phase 2 reuses orchestrator.ts TSC loop

---

## Data Flow

```
                          flint_design_to_code (MCP tool)
                                    |
                        +-----------+-----------+
                        |                       |
                   figmaPayload            library target
                        |                       |
                        v                       v
                +-----------------+    +------------------+
                | HydroPasteEngine|    | Library Adapter  |
                | (deterministic) |    | (idiom block)    |
                +-----------------+    +------------------+
                        |                       |
                        v                       |
        +-------------------------------+       |
        | Phase 1: classifyWithAI()     |<------+
        | (MCP engine, Haiku model)     |
        |                               |
        | Input:  Figma node tree JSON  |
        |         + heuristic results   |
        | Output: ClassificationMap     |
        |         (structured JSON)     |
        +-------------------------------+
                        |
                        v
                +-----------------+
                | HydroPasteEngine|  <-- re-run with AI overrides
                | (deterministic) |
                +-----------------+
                        |
                        v
                  scaffold output
                  (DesignToCodeResult)
                        |
                        v (opt-in, per-component)
        +-------------------------------+
        | Phase 2: refineComponent()    |
        | (MCP engine, Sonnet model)    |
        |                               |
        | Input:  single component JSX  |
        |         + Figma subtree       |
        |         + library idioms      |
        |         + screenshot (if any) |
        | Output: refined JSX string    |
        +-------------------------------+
                        |
                        v
                +-----------------+
                | TSC Validation  |  <-- Commandment 16
                | (in-memory)     |
                +-----------------+
                        |
                  pass?-+-fail?
                  |           |
                  v           v
            refined JSX   original scaffold
                  |           |
                  +-----+-----+
                        |
                        v
                  final DesignToCodeResult
                  (with refinement metadata)
```

---

## Type Contracts

### Phase 1: AI Classification

```typescript
// flint-mcp/src/core/d2cRefinement.ts

/**
 * A single AI classification override for a Figma node.
 * nodeId matches the Figma node name or path for correlation.
 */
export interface ClassificationOverride {
    /** Figma node name or path (e.g., "Frame 42" or "ContactForm/EmailField") */
    nodeName: string
    /** The AI's classification of this node */
    componentType: ComponentType | FrameClassification | 'button'
    /** AI confidence 0.0-1.0 -- overrides below 0.6 are ignored */
    confidence: number
    /** One-sentence reasoning for the classification */
    reasoning: string
}

/**
 * The full classification map returned by the AI.
 */
export interface ClassificationMap {
    overrides: ClassificationOverride[]
    /** Total nodes analyzed */
    nodesAnalyzed: number
    /** How many the AI reclassified vs the heuristic */
    reclassifiedCount: number
}

/**
 * Options for the AI classification pass.
 */
export interface ClassifyOptions {
    /** The Figma node tree (parsed, not stringified) */
    figmaTree: unknown
    /** Heuristic classification results from the deterministic pass */
    heuristicResults: Array<{
        nodeName: string
        heuristicType: string
        heuristicConfidence: number
    }>
    /** Active library target */
    library: string
    /** API key for the AI call (resolved in MCP engine, never crosses IPC) */
    apiKey: string
    /** Optional base URL for corporate gateway routing */
    baseURL?: string
}

/**
 * Classify Figma nodes using AI to improve heuristic accuracy.
 * Pure function aside from the API call. No disk I/O.
 *
 * Model: claude-3-5-haiku (fast, cheap, structured output)
 * Token budget: ~500 in, ~200 out
 * Timeout: 10s hard cap
 */
export async function classifyWithAI(
    options: ClassifyOptions,
): Promise<ClassificationMap>
```

### Phase 2: Targeted Refinement

```typescript
// flint-mcp/src/core/d2cRefinement.ts (same file)

/**
 * Input for per-component AI refinement.
 */
export interface RefineComponentInput {
    /** The deterministic scaffold JSX for this single component */
    scaffoldJSX: string
    /** The Figma subtree JSON for this component */
    figmaSubtree: unknown
    /** Library idiom block (from adapter.getIdiomBlock()) */
    libraryIdioms: string
    /** Library target name */
    library: string
    /** Optional base64-encoded screenshot of this component from Figma */
    screenshotBase64?: string
    /** Design tokens available in this project */
    tokenNames: string[]
    /** Component registry entries (names + props) for reference */
    registryHints: Array<{ name: string; props?: Record<string, unknown> }>
    /** API key (resolved in MCP engine) */
    apiKey: string
    /** Optional base URL */
    baseURL?: string
}

/**
 * Result of per-component refinement.
 */
export interface RefineComponentResult {
    /** Whether refinement succeeded and produced valid output */
    status: 'refined' | 'fallback' | 'error'
    /** The component JSX (refined if status=refined, original if fallback) */
    jsx: string
    /** Updated import statements */
    imports: string[]
    /** What changed vs the original scaffold */
    changes: string[]
    /** If status=error, the reason */
    error?: string
    /** TSC validation passed? */
    tscValid: boolean
    /** Model used for refinement */
    model: string
    /** Token usage for cost tracking */
    tokenUsage?: { input: number; output: number }
}

/**
 * Refine a single component scaffold using AI.
 *
 * Model: claude-3-5-sonnet (balanced accuracy/speed)
 * Token budget: ~2000 in, ~1500 out
 * Timeout: 30s hard cap
 *
 * Commandment 16: Output is validated via in-memory Babel parse + TSC.
 * On validation failure, returns status='fallback' with original scaffold.
 */
export async function refineComponent(
    input: RefineComponentInput,
): Promise<RefineComponentResult>
```

### MCP Tool Extension

```typescript
// flint-mcp/src/tools/designToCode.ts -- extended tool schema

// New optional parameters added to FLINT_DESIGN_TO_CODE_TOOL.inputSchema:
{
    aiClassify: {
        type: 'boolean',
        description:
            'Run AI classification pass to improve component recognition. ' +
            'Adds ~2s latency. Default: false (deterministic-only).',
    },
    aiRefine: {
        type: 'boolean',
        description:
            'Run AI refinement on components with low classification confidence. ' +
            'Adds 3-8s per component. Requires aiClassify=true. Default: false.',
    },
    aiRefineThreshold: {
        type: 'number',
        description:
            'Confidence threshold below which components trigger AI refinement. ' +
            'Range 0.0-1.0. Default: 0.7. Only used when aiRefine=true.',
    },
    screenshotBase64: {
        type: 'string',
        description:
            'Base64-encoded screenshot from Figma get_design_context. ' +
            'Passed to AI refinement for visual understanding. Optional.',
    },
}

// Extended DesignToCodeResult:
export interface DesignToCodeResult {
    // ... existing fields ...

    /** AI classification metadata (only present when aiClassify=true) */
    aiClassification?: {
        overrides: ClassificationOverride[]
        nodesAnalyzed: number
        reclassifiedCount: number
        model: string
        latencyMs: number
    }

    /** Per-component refinement metadata (only present when aiRefine=true) */
    aiRefinements?: Array<{
        componentName: string
        status: 'refined' | 'fallback' | 'error'
        changes: string[]
        model: string
        latencyMs: number
        tokenUsage?: { input: number; output: number }
    }>
}
```

---

## Prompt Templates

### Phase 1: Classification Prompt

```
System: You are a UI component classifier. You analyze Figma design node trees and
classify each node into the correct UI component type for the {library} component
library.

You will receive:
1. A JSON tree of Figma nodes with name, type, and children
2. The heuristic classifications already applied
3. The target library ({library})

Your task: identify nodes where the heuristic classification is WRONG.

Output ONLY a JSON array of overrides. Each override has:
- nodeName: string (exact match to the Figma node name)
- componentType: one of {validTypes}
- confidence: number 0.0-1.0
- reasoning: string (one sentence)

Rules:
- Only output overrides where you disagree with the heuristic
- If you agree with all heuristics, output an empty array
- Never output component types not in the valid list
- confidence below 0.6 will be ignored by the engine

User: Figma tree:
{figmaTreeJSON}

Heuristic results:
{heuristicResultsJSON}

Target library: {library}
```

### Phase 2: Refinement Prompt

```
System: You are a {library} component specialist. You receive a React component
scaffold generated from a Figma design and improve it to be production-ready
{library} code.

{libraryIdiomBlock}

Rules:
1. ONLY use components from the {library} library
2. ONLY use design token classes from this list: {tokenNames}
3. Preserve the overall component structure -- do not add new sections
4. Do not remove existing correct code
5. Do not add state management, event handlers, or business logic
6. Do not invent props or attributes not supported by {library}
7. Fix layout issues: flex direction, gap, padding, alignment
8. Replace generic divs with the correct {library} components when appropriate
9. Ensure all imports are correct for {library}
10. Return ONLY the complete component code (imports + function), nothing else

User: Scaffold to improve:
```tsx
{scaffoldJSX}
```

Figma subtree for reference:
{figmaSubtreeJSON}

{screenshotSection}

Available design tokens: {tokenNamesList}
Available components: {registryHintsList}
```

The `{screenshotSection}` is only included when `screenshotBase64` is provided:

```
Screenshot of this component from Figma:
[image: base64 data]
```

When no screenshot is available, this section is omitted entirely.

---

## Where Does Each Piece Run?

| Function | Process | Why |
|---|---|---|
| `classifyWithAI()` | MCP engine (Node.js) | Needs API key (never crosses to renderer). Runs in `flint-mcp/`. |
| `refineComponent()` | MCP engine (Node.js) | Same -- API key + no renderer dependency. |
| TSC validation | MCP engine (Node.js) | Babel parse is synchronous, runs in the same process. |
| `handleDesignToCode()` | MCP engine (Node.js) | Orchestrates the full pipeline. Already lives here. |
| Screenshot relay | Host IDE (MCP client) | Figma MCP `get_design_context` returns screenshot. Client passes it as `screenshotBase64` param. |

No IPC channels are needed. The entire D2C.5 feature lives within the MCP engine process. The MCP tool schema gains optional parameters; the handler gains optional async steps. Glass is not involved (Glass is observability-only; D2C is an MCP tool).

---

## Fallback Strategy

### Phase 1 (Classification) Failures

| Failure mode | Behavior |
|---|---|
| API call times out (>10s) | Skip classification, use heuristic results only. Log warning. |
| API returns malformed JSON | Skip classification, use heuristic results only. Log warning. |
| API returns overrides for unknown node names | Ignore those overrides silently. |
| API key missing or invalid | Skip classification. Return scaffold with note in summary. |
| Rate limit / quota exceeded | Skip classification. Return scaffold with note in summary. |

### Phase 2 (Refinement) Failures

| Failure mode | Behavior |
|---|---|
| API call times out (>30s) | Return original scaffold for that component. status='fallback'. |
| AI output fails Babel parse | Return original scaffold. status='fallback'. error=parse message. |
| AI output fails TSC validation | Return original scaffold. status='fallback'. error=TSC message. |
| AI removes existing token classes | Detected by post-refinement diff check. Return original. |
| AI adds non-existent imports | Caught by TSC. Return original scaffold. |
| API key missing | Skip refinement for all components. Note in summary. |

The cardinal rule: **the deterministic scaffold is always preserved as the safe fallback**. AI refinement can only improve, never degrade.

---

## File Impact Map

| File | Change | Owner |
|---|---|---|
| `flint-mcp/src/core/d2cRefinement.ts` | NEW -- `classifyWithAI()`, `refineComponent()`, types, prompt builders | `flint-ast-surgeon` |
| `flint-mcp/src/tools/designToCode.ts` | MODIFY -- Add `aiClassify`, `aiRefine`, `aiRefineThreshold`, `screenshotBase64` params; wire into handler | `flint-ast-surgeon` |
| `flint-mcp/src/core/hydroPaste.ts` | MODIFY -- Accept `ClassificationMap` overrides in `processPage()` and `processPayload()` | `flint-ast-surgeon` |
| `flint-mcp/src/core/d2cRefinement.test.ts` | NEW -- Unit tests for classification, refinement, fallback paths | `flint-test-writer` |
| `flint-mcp/src/tools/__tests__/designToCode.test.ts` | MODIFY -- Integration tests for new params | `flint-test-writer` |
| `flint-mcp/src/core/__tests__/hydroPaste.test.ts` | MODIFY -- Tests for classification override injection | `flint-test-writer` |

No Glass files modified. No IPC channels added. No store changes.

---

## Performance Budget

| Operation | Target | Hard Cap | Model |
|---|---|---|---|
| Phase 1: Classification | <2s | 10s | claude-3-5-haiku |
| Phase 2: Refinement (per component) | <5s | 30s | claude-3-5-sonnet |
| Full page (5 sections, classify + refine all) | <30s | 60s | Mixed |
| Deterministic-only (no AI, backward compat) | <500ms | 2s | N/A |

Token cost estimates per invocation:

| Operation | Input tokens | Output tokens | Approx cost |
|---|---|---|---|
| Classification (Haiku) | ~500 | ~200 | ~$0.0002 |
| Refinement per component (Sonnet) | ~2000 | ~1500 | ~$0.015 |
| Full page (5 components, classify + refine) | ~12,500 | ~7,700 | ~$0.077 |

---

## Commandment Checklist

| # | Commandment | Applies? | How satisfied |
|---|---|---|---|
| 2 | No Hallucinated Styling | Yes | Refinement prompt constrains to token list. Post-refinement diff check verifies no arbitrary values introduced. TSC + Mithril audit catches leaks. |
| 4 | Local-First Only | Yes | API calls require user-provided API key. No external URLs in generated code. AI models are external but the feature is opt-in (`aiClassify=false` by default). |
| 8 | Audit-First Execution | Yes | Phase 1 uses Haiku (fast/cheap). Phase 2 uses Sonnet (accuracy). Model selection follows complexity tier pattern from ACX. |
| 9 | CIEDE2000 Delta-E | Yes | Token resolution still uses CIEDE2000 in the deterministic engine. AI cannot bypass this -- it can only reclassify component types, not override color matching. |
| 12 | Atomic Queuing | N/A | D2C does not write to disk (unless `writeThemeFile=true`, which is unchanged). |
| 13 | Deterministic Surgery | Partial | Phase 1 preserves determinism (AI overrides feed back into the deterministic engine). Phase 2 introduces controlled non-determinism but is opt-in and validated. |
| 15 | Granular AST Tools Only | N/A | D2C is a generation tool, not a mutation tool. It produces new code, it does not modify existing AST. Commandment 15 applies to the orchestrator's edit loop, not to code generation. |
| 16 | In-Memory Validation | Yes | Phase 2 output is Babel-parsed and TSC-validated before replacing the scaffold. Invalid output falls back to the deterministic scaffold. |

---

## Implementation Order

### Group 1 (Sequential -- core engine)

**Agent:** `flint-ast-surgeon`

1. Create `flint-mcp/src/core/d2cRefinement.ts` with types, prompt builders, `classifyWithAI()`, `refineComponent()`, and the in-memory Babel/TSC validation wrapper.
2. Modify `flint-mcp/src/core/hydroPaste.ts` -- add `classificationOverrides?: ClassificationMap` parameter to `processPayload()` and `processPage()`. When overrides are present, `classifyFrame()` and `classifyComponent()` check the override map before falling through to heuristics.
3. Modify `flint-mcp/src/tools/designToCode.ts` -- add new optional params to schema and wire the two-phase pipeline into `handleDesignToCode()`.

### Group 2 (Parallel with Group 1 -- tests)

**Agent:** `flint-test-writer`

4. Create `flint-mcp/src/core/__tests__/d2cRefinement.test.ts`:
   - `classifyWithAI()`: mock API responses, test override application, test malformed JSON fallback, test timeout fallback, test confidence filtering
   - `refineComponent()`: mock API responses, test TSC validation pass/fail, test fallback on parse error, test token constraint enforcement
   - Prompt builder: test template rendering with all library targets
5. Extend `flint-mcp/src/core/__tests__/hydroPaste.test.ts`:
   - Test `processPayload()` with classification overrides
   - Test that overrides below confidence threshold are ignored
   - Test that unknown node names in overrides are skipped
6. Extend `flint-mcp/src/tools/__tests__/designToCode.test.ts`:
   - Test `aiClassify=true` flag wiring
   - Test `aiRefine=true` flag wiring
   - Test backward compatibility (`aiClassify` omitted = deterministic only)

### Group 3 (After Groups 1+2 -- integration)

**Agent:** `flint-integration-validator`

7. Full integration test: Figma payload -> classify -> refine -> validate result structure
8. Performance benchmark: verify classification <2s, refinement <5s per component
9. Fallback verification: kill API mid-stream, verify deterministic scaffold is returned

---

## Risks

| Risk | Severity | Commandment threatened | Mitigation |
|---|---|---|---|
| AI classification introduces wrong type, causing worse output than heuristic | Medium | 13 (Determinism) | Confidence threshold (0.6 default). Overrides are advisory -- engine re-runs, it does not blindly substitute. User can set `aiClassify=false`. |
| AI refinement generates code with arbitrary color values | High | 2 (No Hallucinated Styling), 9 (CIEDE2000) | Prompt constrains to token list. Post-refinement Mithril audit. TSC catches missing imports. Fallback to scaffold on any violation. |
| API latency makes D2C feel slow | Medium | UX quality | Phase 1 is <2s (Haiku). Phase 2 is opt-in. Default is deterministic-only (no latency change). Summary message reports timings. |
| API cost accumulates on full-page designs | Low | Cost governance | Cost estimates in result metadata. Per-component opt-in. Documentation recommends classify-only for large pages. |
| Screenshot base64 inflates prompt size | Low | Cost/latency | Screenshot is optional. Only passed to Phase 2 (per-component), not Phase 1. Resized to 1024px max before encoding (caller responsibility). |
| Non-determinism makes D2C output unreliable across runs | Medium | 13 (Determinism) | Phase 1 is deterministic (overrides are cached per session). Phase 2 is explicitly opt-in. Default behavior unchanged. |

---

## Screenshot Integration

The Figma MCP server's `get_design_context` tool returns a screenshot alongside the AST payload. The screenshot is already available to the MCP client (Claude Code, Cursor, etc.) at the point where `flint_design_to_code` is called.

The integration path:
1. MCP client calls Figma MCP `get_design_context` -> receives `{ code, screenshot, ... }`
2. MCP client calls `flint_design_to_code` with `screenshotBase64: screenshot` (pass-through)
3. `handleDesignToCode()` passes it to `refineComponent()` for Phase 2 only
4. The Anthropic API supports base64 image content blocks natively -- no conversion needed

When no screenshot is available (e.g., user provides raw Figma JSON without going through `get_design_context`), Phase 2 still works but relies on the Figma subtree JSON alone. The prompt template conditionally omits the screenshot section.

---

## API Key Resolution

Both `classifyWithAI()` and `refineComponent()` need an API key. Since D2C runs in the MCP engine (not the Electron main process), it cannot use `electron/orchestrator.ts`'s `readConfig()` which depends on `safeStorage`.

Resolution order for the MCP engine:
1. `ANTHROPIC_API_KEY` environment variable (standard for MCP servers)
2. `.flint/config.json` `apiKey` field (plaintext -- MCP runs headless, no `safeStorage`)
3. If neither is available, AI features are skipped and the deterministic scaffold is returned

This matches how other MCP tools that need API access would resolve credentials. The MCP engine is headless -- it does not have access to Electron's `safeStorage`. This is documented and intentional.
