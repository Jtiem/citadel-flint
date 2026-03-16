# Contract: ACX — Complexity Router (Commandment 8: Audit-First Execution)

## Status: DESIGN COMPLETE — Ready for Phase 2 Implementation

---

## Architectural Summary

The Complexity Router is a deterministic, zero-latency pre-flight classifier that sits between `sendChatMessage()` receiving a conversation and it constructing the Anthropic SDK call. It inspects the user's most recent message plus available workspace signals to assign a complexity tier (`atomic`, `compound`, or `architectural`), selects the appropriate model from the `ANTHROPIC_MODELS` roster, and attaches an escalation path for retry. No AI call is made for classification — the entire pipeline runs synchronously in under 10ms.

The router plugs into `electron/orchestrator.ts` only. No renderer-side changes are needed. The selected model overrides the `config.model` value for that invocation, while the user's saved preference is not mutated.

---

## 1. Complexity Classification

Three tiers map onto the model roster and expected tool-call depth.

### Tier 1 — Atomic (Haiku: `claude-3-5-haiku-20241022`)

A task is Atomic when a single, targeted, reversible tool call can satisfy it. The pre-flight estimate is 1–2 tool calls (one read + one mutation). Examples:

- "Change the button label to 'Submit'"
- "Add `mt-4` to the hero heading"
- "Remove the `text-red-500` class from the error text"
- "Update the aria-label on the close icon"

Atomic tasks operate on a single named node and a single property or text value. The user message refers to a single component or element by name or visible reference.

### Tier 2 — Compound (Sonnet: `claude-3-5-sonnet-20241022`)

A task is Compound when it spans multiple nodes within a single file, or involves a structural operation (insert, wrap, delete) on a single node. The pre-flight estimate is 3–8 tool calls. Examples:

- "Fix all the spacing violations in the card component"
- "Restyle the navigation bar to match the new brand tokens"
- "Wrap the icon in a flex container"
- "Add a new list item to the nav with matching styling"
- "Resolve the accessibility violations in this form"

Compound tasks may reference multiple elements, mention a "component" holistically, involve fixing a set of violations, or use verbs like "restyle", "restructure", "fix all", or "align".

### Tier 3 — Architectural (Opus: `claude-opus-4-5`)

A task is Architectural when it crosses file boundaries, introduces a new named component, involves conditional logic or state, or requires understanding of the full design system. The pre-flight estimate is 9+ tool calls or any cross-file reference. Examples:

- "Extract the hero section into its own component file"
- "Create a new `FeatureCard` component matching the pattern from `HeroSection`"
- "Update the color tokens and fix every component that references the old brand color"
- "Move the sidebar navigation into a shared layout component"
- "Refactor the form to use the new `Input` component from the design system"

Architectural tasks use verbs like "create", "extract", "move", "refactor", or "migrate", or they name multiple files, or they describe behavior and state.

---

## 2. Classification Signals

All signals are extracted synchronously from data that is available at call time. No disk I/O is performed. The scoring is additive: a base tier is computed from the message, then workspace signals raise it. A signal can never lower the tier from a higher classification.

### Signal Group A: Message Content (Primary — up to +2 tier raises)

**Keyword extraction from the last user message:**

```typescript
// Tier floor: ATOMIC (0 points)
// Compounds signals — if any match, floor becomes COMPOUND:
const COMPOUND_VERBS = [
  'restyle', 'restructure', 'fix all', 'fix the violations', 'align',
  'update all', 'clean up', 'apply tokens', 'change the color scheme',
  'reorder', 'refactor layout', 'adjust spacing', 'wrap', 'insert',
  'add a new', 'delete', 'remove the'
]
const COMPOUND_NOUNS = [
  'violations', 'accessibility issues', 'design debt', 'the form',
  'the nav', 'the card', 'the layout', 'all the'
]

// Architectural signals — if any match, floor becomes ARCHITECTURAL:
const ARCHITECTURAL_VERBS = [
  'create', 'extract', 'move', 'migrate', 'scaffold', 'build',
  'introduce', 'set up', 'implement', 'generate', 'compose',
  'new component', 'refactor', 'redesign'
]
const ARCHITECTURAL_NOUNS = [
  'component', 'page', 'layout', 'across files', 'shared', 'library',
  'token system', 'multiple files', 'new file', 'pattern'
]
```

**Message length heuristic:** Messages over 120 characters typically describe multi-step intent. This is a weak signal that can raise Atomic to Compound but cannot raise Compound to Architectural on its own.

**Multi-sentence heuristic:** More than one sentence in the request indicates compound intent. Two or more sentences is a Compound floor unless an Architectural keyword is also present.

**Quantifier detection:** "all", "every", "each", "multiple", "several" applied to elements or violations raises to Compound. If applied to files or components, raises to Architectural.

### Signal Group B: Workspace Context (Secondary — environment-derived)

These signals are passed into the router from the IPC call site in `main.ts` or derived from the `messages` array. They supplement but do not override the message analysis.

**Violation count:**
- 0 violations: no signal contribution
- 1–4 violations: +0 (stays at message-determined tier)
- 5–12 violations: floor is Compound if task mentions violations at all
- 13+ violations: floor is Compound regardless; Architectural if verbs suggest global fix

**Session message depth:**
- Conversation turns 1–3: no boost (context is fresh)
- Turns 4–8: Compound floor if Atomic tier was assigned (iterative sessions accumulate scope)
- Turns 9+: Compound floor unconditionally (extended sessions rarely stay atomic)

**File count in workspace (if passed):**
- 1 file open: no signal contribution
- 2–5 files: Architectural floor if ARCHITECTURAL_NOUNS or cross-file verbs are present
- 6+ files: Architectural floor if ANY cross-file language appears

**Active file extension:**
- `.tsx` / `.ts`: standard scoring
- `.vue`: Compound floor (Vue SFCs contain template + script + style — single-file but multi-zone)
- `.html`: Atomic is valid (typically simple prop/text edits)

### Signal Group C: Prior Turn Evidence (Tertiary — from the existing `messages` array)

The router inspects the last assistant turn's tool calls (from the `messages` already built in `sendChatMessage`) to detect established scope:

- If the previous assistant turn used 5+ tool calls: Compound floor
- If the previous assistant turn used `bridge_insert_node` or `bridge_wrap_node`: Compound floor
- If the previous assistant turn referenced more than one unique `targetId`: Compound floor

This prevents an escalation-happy session from being misclassified as Atomic on a follow-up message.

---

## 3. Classification Algorithm

The algorithm is a deterministic scoring tree. It executes in a single pass over the message string and the contextual signals. It has no branches that require I/O.

```typescript
function classifyComplexity(input: RouterInput): ComplexityTier {
  // Phase 1: Extract message-based floor
  const msg = input.lastUserMessage.toLowerCase()

  let floor: ComplexityTier = 'atomic'

  // Architectural keywords take highest priority
  if (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS)) {
    floor = 'architectural'
  } else if (
    containsAny(msg, COMPOUND_VERBS) ||
    containsAny(msg, COMPOUND_NOUNS) ||
    countSentences(msg) >= 2 ||
    (msg.length > 120 && containsQuantifier(msg))
  ) {
    floor = 'compound'
  }

  // Phase 2: Apply workspace signal raises (never lower)

  // Violation count raise
  if (floor !== 'architectural' && input.violationCount >= 5 && mentionsViolations(msg)) {
    floor = raise(floor, 'compound')
  }
  if (floor !== 'architectural' && input.violationCount >= 13 && mentionsViolations(msg)) {
    floor = raise(floor, 'compound')
  }

  // Session depth raise
  if (floor === 'atomic' && input.sessionTurns >= 4) {
    floor = 'compound'
  }

  // File count raise
  if (floor !== 'architectural' && input.openFileCount >= 2) {
    if (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS)) {
      floor = 'architectural'
    }
  }

  // Vue SFC raise
  if (input.activeFileExtension === 'vue' && floor === 'atomic') {
    floor = 'compound'
  }

  // Phase 3: Prior turn evidence raises
  if (floor === 'atomic' && (
    input.priorToolCallCount >= 5 ||
    input.priorToolNames.includes('bridge_insert_node') ||
    input.priorToolNames.includes('bridge_wrap_node') ||
    input.priorUniqueTargetIds >= 2
  )) {
    floor = 'compound'
  }

  return floor
}

// Helper: raise only — never lower
function raise(current: ComplexityTier, target: ComplexityTier): ComplexityTier {
  const rank: Record<ComplexityTier, number> = { atomic: 0, compound: 1, architectural: 2 }
  return rank[target] > rank[current] ? target : current
}
```

### Performance Contract

The full `classifyComplexity()` function — including signal extraction — must complete in under 10ms on any message up to 2,000 characters. This is enforced by:

1. No async operations. All inputs are already in memory.
2. `containsAny()` is a single `Array.some(keyword => msg.includes(keyword))` call. No regex.
3. The keyword lists are module-level `const` arrays, initialized once, never rebuilt.
4. The algorithm has O(K) complexity where K is the total keyword count (approximately 50 keywords).

---

## 4. Model Selection and Escalation Path

### Model Mapping

```typescript
const TIER_TO_MODEL: Record<ComplexityTier, string> = {
  atomic:       'claude-3-5-haiku-20241022',
  compound:     'claude-3-5-sonnet-20241022',
  architectural: 'claude-opus-4-5',
}
```

Note: `claude-3-7-sonnet-20250219` is the user-configured default and is preserved for the OpenAI and Gemini branches, which do not use the complexity router. For the Anthropic branch only, the router replaces `config.model` for the duration of the call.

### Escalation Path

Each tier carries a fallback escalation list for the retry-on-validation-failure loop. The escalation list defines which model to try on retry N:

```typescript
const ESCALATION_PATH: Record<ComplexityTier, string[]> = {
  atomic:        ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  compound:      ['claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  architectural: ['claude-opus-4-5'],  // no escalation — already at ceiling
}
```

Escalation is triggered when:
- `validateToolInput()` returns a non-null error on 2+ consecutive attempts from the same model
- The model's response contains zero tool calls when at least one was expected (detected by `message_stop` event with no `tool_use` blocks)

Escalation is NOT triggered by a single Mithril or LSP validation error — those are fed back silently to the same model for self-correction, which is the existing Commandment 16 loop.

### Cost/Latency Budget

| Tier | Model | Target P95 Latency | Estimated Cost/Call | When to Escalate |
|------|-------|--------------------|---------------------|------------------|
| Atomic | Haiku | < 2s | ~$0.001 | After 2 failed self-corrections |
| Compound | Sonnet | < 5s | ~$0.008–0.012 | After 2 failed self-corrections |
| Architectural | Opus | < 20s | ~$0.08–0.15 | No escalation — surface error to user |

Classification overhead: < 10ms (zero latency impact on perceived response start).

---

## 5. TypeScript Interface

The router is fully typed. All types live in `electron/orchestrator.ts` alongside the router implementation.

```typescript
// ── Complexity Router Types (ACX) ────────────────────────────────────────────

export type ComplexityTier = 'atomic' | 'compound' | 'architectural'

/**
 * A single signal that contributed to the complexity assessment.
 * Stored in ComplexityAssessment.signals for logging and transparency.
 */
export interface ComplexitySignal {
  /** Identifier for the signal source. */
  source:
    | 'architectural_keyword'
    | 'compound_keyword'
    | 'message_length'
    | 'multi_sentence'
    | 'quantifier'
    | 'violation_count'
    | 'session_depth'
    | 'file_count'
    | 'vue_sfc'
    | 'prior_tool_depth'
    | 'prior_structural_tool'
    | 'prior_multi_target'
  /** Human-readable description of why this signal fired. */
  reason: string
  /** The tier floor this signal established or confirmed. */
  tierContribution: ComplexityTier
}

/**
 * The output of classifyComplexity(). Carries the selected model, the full
 * escalation path, and the audit trail of signals that produced the decision.
 *
 * This is passed directly into sendChatMessage() to override model selection
 * for the duration of the Anthropic SDK call.
 */
export interface ComplexityAssessment {
  /** The resolved complexity tier for this task. */
  tier: ComplexityTier
  /** The model ID to use for this call (from TIER_TO_MODEL). */
  selectedModel: string
  /**
   * One-sentence summary of why this tier was chosen.
   * Logged to console in development builds. Not shown to the user.
   */
  reasoning: string
  /** All signals that fired during classification. Ordered by contribution. */
  signals: ComplexitySignal[]
  /**
   * Ordered fallback models to attempt if the selected model fails validation.
   * The first entry is always selectedModel. Subsequent entries are escalation
   * targets. Empty for architectural (already at ceiling).
   */
  escalationPath: string[]
}

/**
 * All inputs available to the router synchronously at call time.
 * Constructed in sendChatMessage() before the Anthropic SDK call.
 */
export interface RouterInput {
  /** The content of the most recent user-role message. */
  lastUserMessage: string
  /** Total number of active governance/Mithril/A11y violations in the workspace. */
  violationCount: number
  /** Number of prior conversation turns in this session (message pairs). */
  sessionTurns: number
  /** Number of files open in the workspace (from canvasStore workspace tree). */
  openFileCount: number
  /** File extension of the currently active file, without the dot. E.g. 'tsx'. */
  activeFileExtension: string
  /**
   * Count of tool calls made in the immediately preceding assistant turn.
   * Derived from the messages array: count tool_call role entries at the end
   * of the last assistant segment.
   */
  priorToolCallCount: number
  /**
   * Tool names used in the immediately preceding assistant turn.
   * Used to detect prior structural operations.
   */
  priorToolNames: string[]
  /**
   * Count of unique targetId values referenced in the preceding assistant turn.
   * Used to detect prior multi-node scope.
   */
  priorUniqueTargetIds: number
}
```

---

## 6. Integration Point in `sendChatMessage()`

The router inserts at a single point: immediately after the `anthropicMessages` array is fully built and immediately before the `client.messages.stream()` call. The OpenAI and Gemini branches are unaffected.

### Exact insertion location in `orchestrator.ts`

```typescript
// Current code (line ~586):
const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: BRIDGE_TOOLS,
    messages: anthropicMessages,
})

// After ACX integration:
const routerInput = buildRouterInput(messages, activeFilePath)
const assessment = classifyComplexity(routerInput)
const resolvedModel = assessment.selectedModel
console.log(`[Bridge ACX] tier=${assessment.tier} model=${resolvedModel} reason="${assessment.reasoning}"`)

const stream = await client.messages.stream({
    model: resolvedModel,          // <-- router result, not config.model
    max_tokens: resolvedModel === 'claude-opus-4-5' ? 8192 : 4096,
    system: SYSTEM_PROMPT,
    tools: BRIDGE_TOOLS,
    messages: anthropicMessages,
})
```

The `max_tokens` increase for Opus is because Architectural tasks frequently involve longer reasoning chains and more tool call sequences. Haiku and Sonnet remain at 4096.

### `buildRouterInput()` — Extracting Signals from Available Data

```typescript
function buildRouterInput(messages: ChatMessage[], activeFilePath?: string | null): RouterInput {
  // Last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const lastUserMessage = lastUserMsg?.content ?? ''

  // Session turn count: number of user messages
  const sessionTurns = messages.filter(m => m.role === 'user').length

  // Prior assistant turn: find the last contiguous block of tool_call entries
  const priorToolCalls = extractPriorToolCalls(messages)
  const priorToolCallCount = priorToolCalls.length
  const priorToolNames = priorToolCalls.map(m => m.toolName ?? '').filter(Boolean)
  const priorUniqueTargetIds = countUniqueTargetIds(priorToolCalls)

  // Violation count: synchronous SQLite query (better-sqlite3 is always sync)
  const violationCount = loadCurrentViolationCount()

  // Active file extension
  const activeFileExtension = activeFilePath
    ? (activeFilePath.split('.').pop()?.toLowerCase() ?? 'tsx')
    : 'tsx'

  // Open file count: not available in sendChatMessage() signature today.
  // Default to 1 for now. Phase 2 can pass this via the IPC payload extension.
  const openFileCount = 1

  return {
    lastUserMessage,
    violationCount,
    sessionTurns,
    openFileCount,
    activeFileExtension,
    priorToolCallCount,
    priorToolNames,
    priorUniqueTargetIds,
  }
}
```

Note on `openFileCount`: The current `sendChatMessage()` signature does not receive workspace tree state. The IPC payload in `main.ts` should be extended in Phase 2 to pass `openFileCount` as an optional parameter. Until that extension lands, `openFileCount` defaults to 1, which means cross-file signals are inactive. This is safe — it conservatively underestimates scope but never over-routes to a cheaper model.

### `loadCurrentViolationCount()` — Synchronous SQLite Query

```typescript
// Module-level prepared statement (never reconstruct per call)
const _violationCountStmt = db.prepare(
  `SELECT COUNT(*) as count FROM governance_events
   WHERE event_type = 'violation' AND resolved = 0`
)

function loadCurrentViolationCount(): number {
  try {
    const row = _violationCountStmt.get() as { count: number } | undefined
    return row?.count ?? 0
  } catch {
    return 0  // safe default — never block routing on a DB error
  }
}
```

If the `governance_events` table does not exist (new project, no Mithril run yet), the catch block returns 0 and routing continues unaffected.

---

## 7. Adaptive Routing — Escalation in the Validation Loop

The existing Commandment 16 loop in `sendChatMessage()` feeds validation errors back as silent tool results. The ACX layer adds one behavior on top: if the same tool call fails Mithril or LSP validation on its second consecutive attempt, the loop escalates to the next model in `assessment.escalationPath` rather than retrying indefinitely with the same model.

### Escalation State

The escalation state is local to a single `sendChatMessage()` invocation. It is not persisted across calls.

```typescript
// Local escalation tracker within the Anthropic branch of sendChatMessage()
let currentModelIndex = 0
const escalationPath = assessment.escalationPath
let consecutiveValidationFailures = 0

// On each validation_error:
consecutiveValidationFailures++
if (consecutiveValidationFailures >= 2 && currentModelIndex < escalationPath.length - 1) {
  currentModelIndex++
  consecutiveValidationFailures = 0
  // Restart the stream with escalationPath[currentModelIndex]
  // The messages array is unchanged — the escalated model gets the same context
}
```

The escalation restart is a full new `client.messages.stream()` call. The existing `anthropicMessages` array (which now includes the failed tool_result) is passed intact so the escalated model has full context about what was tried and why it failed.

### Success Rate Learning (Phase 2 Enhancement)

Phase 2 may add a lightweight success-rate tracker backed by the `governance_events` SQLite table. The tracker would record, per task tier, whether the first-selected model succeeded or required escalation:

```sql
-- Future addition to governance_events schema:
INSERT INTO governance_events (event_type, metadata, created_at)
VALUES ('acx_routing', json_object(
  'tier', ?, 'selectedModel', ?, 'escalated', ?, 'finalModel', ?
), CURRENT_TIMESTAMP)
```

This is not part of the Phase 1 contract. Phase 1 implements the deterministic router only. Learning telemetry is a Phase 2 enhancement tracked separately.

---

## 8. Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `electron/orchestrator.ts` | MODIFY — add `ComplexityTier`, `ComplexitySignal`, `ComplexityAssessment`, `RouterInput` types; add `classifyComplexity()`, `buildRouterInput()`, `loadCurrentViolationCount()`, `TIER_TO_MODEL`, `ESCALATION_PATH` constants; modify Anthropic branch of `sendChatMessage()` to invoke the router | bridge-orchestrator |
| `electron/__tests__/orchestrator.complexity.test.ts` | NEW FILE — unit tests for the classification algorithm | bridge-test-writer |

No other files require modification. The router is entirely self-contained within the main process. The renderer, IPC surface, preload, and all stores are unaffected.

---

## 9. Type Contracts (Source of Truth for Phase 2)

The types in Section 5 above are the source of truth. They are all added to `electron/orchestrator.ts` as exported TypeScript interfaces. No renderer-side types are needed because the complexity assessment never crosses the IPC boundary — it is an internal main-process decision.

The `sendChatMessage()` function signature does not change. Model selection happens internally.

---

## 10. Commandment Checklist

- [x] **C8 Audit-First Execution** — this contract is the direct implementation. Every task is classified before a model is selected.
- [x] **C4 Local-First Only** — classification uses only in-memory message data and a single synchronous SQLite read. No external calls.
- [x] **C9 Process Boundary** — router lives entirely in `electron/orchestrator.ts` (main process). Renderer sees no change.
- [x] **C12 Atomic Queuing** — the `_violationCountStmt` is a module-level prepared statement; it is never re-prepared per call.
- [x] **C13 Deterministic Surgery** — the keyword matcher uses `String.prototype.includes()`, not regex. No regex on source code.
- [x] **C14 Bypass Prohibition** — the SQLite violation count query uses the shared `db` singleton from `electron/store.ts`. No direct `better-sqlite3` instantiation.
- [x] **C15 Granular AST Tools Only** — the router does not add or remove tools. The `BRIDGE_TOOLS` catalog is unchanged.
- [x] **C16 In-Memory Validation** — the escalation logic described in Section 7 is additive to the existing validation loop. It does not replace or weaken it.

---

## 11. Testing Requirements

All tests live in `electron/__tests__/orchestrator.complexity.test.ts` (new file). The test runner is vitest (`npm test` at project root).

### Classification Algorithm Tests (20 minimum)

| Test | Input | Expected Tier |
|------|-------|---------------|
| Single prop change | "Change the button color to brand-primary" | atomic |
| Single text change | "Update the heading to 'Welcome back'" | atomic |
| Single class addition | "Add mt-4 to the hero section" | atomic |
| Multiple violations fix | "Fix all the design violations", violationCount=8 | compound |
| Compound verb | "Restyle the navigation bar" | compound |
| Wrap structural op | "Wrap the icon in a flex container" | compound |
| Multi-sentence | "Update the heading. Also fix the spacing on the cards." | compound |
| Long message no compound keyword | 130-char message with no structural keywords | atomic (length alone does not compound) |
| Architectural verb | "Create a new FeatureCard component" | architectural |
| Extract verb | "Extract the hero section into its own file" | architectural |
| Cross-file noun | "Update the shared layout component" | architectural |
| Architectural + no workspace signals | "Refactor the form", openFileCount=1 | architectural |
| Quantifier alone | "Fix all the buttons", violationCount=2 | compound |
| Vue SFC atomic input | "Change the button label", ext=vue | compound (Vue raise) |
| Vue SFC compound input | "Restyle the nav", ext=vue | compound (already compound) |
| Session depth raise | "Change the label", sessionTurns=5 | compound (depth raise) |
| Session depth no raise | "Change the label", sessionTurns=2 | atomic |
| Prior structural tool | priorToolNames=['bridge_insert_node'] | compound (prior tool raise) |
| Prior multi-target | priorUniqueTargetIds=3 | compound (prior scope raise) |
| Architectural keyword beats all | "Create a component", violationCount=0, sessionTurns=1 | architectural |

### Escalation Path Tests (5 minimum)

| Test | Expected escalationPath[0] | Expected escalationPath[1] |
|------|--------------------------|--------------------------|
| Atomic tier | claude-3-5-haiku-20241022 | claude-3-5-sonnet-20241022 |
| Atomic tier full path | 3 models total | claude-opus-4-5 as [2] |
| Compound tier | claude-3-5-sonnet-20241022 | claude-opus-4-5 |
| Compound tier length | 2 models total | — |
| Architectural tier | claude-opus-4-5 | escalationPath.length === 1 |

### Signal Transparency Tests (5 minimum)

| Test | Expected signals array |
|------|----------------------|
| Architectural keyword | signals contains entry with source='architectural_keyword' |
| Violation count raise | signals contains source='violation_count' when count >= 5 |
| Session depth raise | signals contains source='session_depth' when turns >= 4 |
| Vue SFC raise | signals contains source='vue_sfc' |
| No signals on clean atomic | signals array has length 0 or only message-negative entries |

### Performance Test (1)

Measure `classifyComplexity()` wall-clock time on a 2,000-character message with all workspace signals populated. Assert duration < 10ms.

### Report Format

```
[core]: X/Y passing (Z new)
TSC:   0 errors
```

---

## 12. Files Summary

### New Files (2)

1. `/Users/tiemann/Lunar-Elevator-Bridge/electron/__tests__/orchestrator.complexity.test.ts`
2. `/Users/tiemann/Lunar-Elevator-Bridge/.bridge-context/contracts/ACX-ComplexityRouter.md` (this file)

### Modified Files (1)

1. `/Users/tiemann/Lunar-Elevator-Bridge/electron/orchestrator.ts`

---

## 13. Implementation Notes for Phase 2 Agent

### Keyword List Placement

The `COMPOUND_VERBS`, `COMPOUND_NOUNS`, `ARCHITECTURAL_VERBS`, and `ARCHITECTURAL_NOUNS` arrays must be declared as module-level `const` values at the top of `orchestrator.ts`, before the `sendChatMessage` export. They must NOT be declared inside `classifyComplexity()` — function-scoped array literals are re-allocated on every call, which is unnecessary and slightly wasteful.

### `extractPriorToolCalls()` Implementation

Scan the `messages` array in reverse. Collect all `ChatMessage` entries with `role === 'tool_call'` that appear in the last assistant segment (before the last user message). Stop at the first non-`tool_call`, non-`assistant` boundary. This correctly handles multi-turn sessions where earlier turns had their own tool calls.

### `countUniqueTargetIds()` Implementation

Extract `toolInput.targetId` from each `ChatMessage` in the prior tool calls. Deduplicate with a `Set`. Return `Set.size`. Messages without a `targetId` in their input are ignored. Read-only tools (`bridge_read_code`, `bridge_read_tokens`) never have a `targetId` and are correctly excluded.

### Do Not Touch

- The OpenAI and Gemini branches of `sendChatMessage()` must not be modified. The complexity router applies only to the Anthropic branch.
- The `BRIDGE_TOOLS` catalog is immutable in this contract. No tools are added or removed.
- The `validateToolInput()` function is immutable in this contract. Escalation is a wrapper around the existing validation loop, not a replacement.
- The `SYSTEM_PROMPT` is immutable. The selected model does not need a tier-specific system prompt.
