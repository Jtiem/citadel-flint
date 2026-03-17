# Architectural Decision Record: P0-4 -- Provider Parity for Commandments 15+16

**Version:** 1.0
**Date:** 2026-03-16
**Status:** PROPOSED -- Awaiting team review
**Priority:** P0 (governance integrity)
**Security Review Ref:** `.bridge-context/reviews/SEC-surface-review.md`
**Related Code:** `electron/orchestrator.ts` lines 862-902

---

## 1. Context

Bridge's core value proposition is deterministic governance enforcement. The AI Orchestrator (`electron/orchestrator.ts`) is constrained by two commandments:

- **Commandment 15 (Granular AST Tools Only):** The AI model MUST only emit operations from the versioned Bridge Tool Catalog (`bridge_read_code`, `bridge_read_tokens`, `bridge_audit_mithril`, `bridge_audit_a11y`, `bridge_update_props`, `bridge_update_text`, `bridge_insert_node`, `bridge_wrap_node`, `bridge_delete_node`, `bridge_add_class`, `bridge_remove_class`, `bridge_search_design_system`). Raw code string generation is prohibited.

- **Commandment 16 (In-Memory Validation Loop):** All AI-proposed mutations MUST be type-checked via an in-memory TSC/Babel validation before surfacing a confirmation UI to the user.

### The Problem

The `sendChatMessage()` function in `orchestrator.ts` has three provider branches:

**Anthropic branch (lines 903+):** Fully compliant. Uses the `tools` parameter with `BRIDGE_TOOLS` catalog. The AI can only propose changes via tool_use blocks. Each tool_use is validated in-memory before being surfaced. This is the reference implementation.

**OpenAI branch (lines 862-883):**

```typescript
if (config.provider === 'openai') {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey: config.apiKey, ... })
    const stream = await client.chat.completions.create({
        model,
        stream: true,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.filter(m => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))
        ]
    })
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
            onChunk({ type: 'text', text: delta.content })
        }
    }
    onChunk({ type: 'done' })
}
```

This branch sends a plain chat completion with NO `tools` or `functions` parameter. The model responds with free-form text. There is no tool_use parsing, no Babel validation, no mutation proposal flow. The user sees raw text in the chat panel. Commandments 15 and 16 are completely unenforced.

**Gemini branch (lines 884-902):** Identical problem. Uses `generateContentStream` with no tool declarations. The model returns free-form text. No tool_use, no validation.

### Impact

A user who configures an OpenAI or Gemini API key gets a fundamentally different product: an ungovernanced chat assistant that can suggest arbitrary code changes with no design system enforcement, no accessibility checks, no Mithril safety, and no in-memory type validation. This is not a degraded experience -- it is the complete absence of the governance guarantees Bridge promises.

---

## 2. Decision Drivers

1. **Governance integrity:** Bridge is a governance product. Silently disabling governance for a subset of users undermines the product's credibility.
2. **Implementation effort:** Adding tool-use support for OpenAI and Gemini requires implementing their respective function-calling/tool-use APIs, mapping BRIDGE_TOOLS to their schema formats, parsing their tool_use responses, and feeding tool results back into the conversation loop.
3. **User demand:** The OpenAI and Gemini branches exist presumably for users who have API keys for those providers. The number of such users relative to Anthropic users is unknown.
4. **Maintenance burden:** Each additional provider doubles the surface area for tool-use bugs, prompt engineering differences, and validation edge cases.

---

## 3. Options Considered

### Option A: Implement tool-use for all providers

Implement OpenAI function-calling and Gemini tool-use equivalents of the Bridge AST Tool Catalog.

**Changes required:**
- Map `BRIDGE_TOOLS` (Anthropic format) to OpenAI `functions` / `tools` parameter format
- Map `BRIDGE_TOOLS` to Gemini `tools` / `functionDeclarations` format
- Parse OpenAI `function_call` / `tool_calls` response chunks
- Parse Gemini `functionCall` response parts
- Implement the tool result feedback loop for both providers (send tool results back as subsequent messages)
- Apply the same in-memory Babel/TSC validation to tool_use outputs from all providers
- Test each provider's tool-use flow end-to-end

**Effort:** 3-5 engineering days per provider (6-10 days total)
**Risk:** Medium -- each provider has different tool-use semantics, streaming behavior, and edge cases. Ongoing maintenance as provider APIs evolve.
**Commandment compliance:** Full -- all providers enforce C15 and C16.

### Option B: Hard gate non-Anthropic providers (RECOMMENDED)

Add a guard at the top of `sendChatMessage()` that rejects non-Anthropic providers with a clear, actionable error message.

**Changes required:**
- Add a provider check before the provider branches in `sendChatMessage()`
- Return an error chunk explaining the constraint
- Remove or comment out the OpenAI and Gemini branches (dead code elimination)
- Update the `ai:save-config` handler or the renderer's AI settings UI to warn when saving a non-Anthropic provider

**Effort:** 1-2 hours
**Risk:** Low -- removes code rather than adding it.
**Commandment compliance:** Full -- the only active code path enforces C15 and C16.

### Option C: Warning + degraded mode

Allow non-Anthropic providers but display a prominent warning in Glass that governance enforcement is disabled for the current session.

**Changes required:**
- Add a `governanceActive: boolean` flag to the orchestrator response
- Surface a persistent amber warning banner in Glass
- Document the degradation clearly

**Effort:** 4-6 hours
**Risk:** High -- a governance product that advertises "governance is off" invites users to operate in an ungovernanced state. This is architecturally incoherent.
**Commandment compliance:** None for non-Anthropic sessions.

---

## 4. Decision

**Option B -- Hard gate non-Anthropic providers.**

### Rationale

1. Bridge's entire reason for existence is deterministic governance enforcement. A "governance engine" that silently turns off governance for a subset of users is not credible. Option B is honest about the current constraint.

2. The OpenAI and Gemini branches currently provide zero governance value. They are plain chat completions identical to what the user could get from ChatGPT or Gemini directly. Removing them loses no governance functionality.

3. Option A is the correct long-term solution, but it should be prioritized by actual user demand, not implemented speculatively. When demand exists (tracked issue, user request, or strategic partnership), a dedicated sprint can implement provider parity properly.

4. Option C is architecturally incoherent. A prominent "governance is off" warning in a governance product signals that the product is incomplete, not that it is secure.

---

## 5. Implementation Specification

### 5.1 orchestrator.ts changes

**File:** `electron/orchestrator.ts`

In `sendChatMessage()` (line 848), after reading the config and checking for an API key, add a provider guard:

```typescript
// After line 859 (the apiKey check):

// SEC P0-4: Only the Anthropic provider supports the constrained Bridge Tool
// Catalog (Commandment 15) and in-memory validation loop (Commandment 16).
// Non-Anthropic providers send plain chat completions with no tool-use,
// which means governance enforcement is completely absent.
if (config.provider && config.provider !== 'anthropic') {
    onChunk({
        type: 'error',
        error:
            'Bridge requires an Anthropic API key for AI-assisted editing. ' +
            'The Bridge Tool Catalog (Commandment 15) and in-memory validation ' +
            '(Commandment 16) are only enforced via Anthropic tool-use. ' +
            'Non-Anthropic providers bypass all governance checks. ' +
            'Please configure an Anthropic API key in AI Settings.',
    })
    return
}
```

Then remove (or comment out with a `// TODO: Option A -- implement tool-use parity` marker) the OpenAI branch (lines 862-883) and the Gemini branch (lines 884-902). The `try` block should proceed directly to the Anthropic branch (line 903+).

### 5.2 ai:save-config IPC response

**File:** `electron/main.ts` (the `ai:save-config` handler)

No change to the handler itself. The config is saved as-is. The guard is in `sendChatMessage()`, so a user can save any provider config but will receive the error when they try to chat.

This is intentional: users may configure non-Anthropic providers for other integrations (e.g., a future read-only RAG query path). The guard only blocks the governed chat path.

### 5.3 Glass error surfacing

The `onChunk({ type: 'error', error: '...' })` path already exists and is handled by the `orchestratorStore` in the renderer. The error message appears in the AgentChatPanel as a red error block. No UI changes are needed.

### 5.4 Future path to Option A

When implementing Option A in a future sprint:
1. Create `electron/providers/openai-adapter.ts` and `electron/providers/gemini-adapter.ts`
2. Each adapter maps `BRIDGE_TOOLS` to the provider's format
3. Each adapter implements the tool-use response parsing loop
4. Each adapter feeds tool results back to the conversation
5. The common validation path (`validateMutationInMemory`) is shared across all adapters
6. Tests must verify that each provider's tool-use output passes through the same Babel/TSC validation as the Anthropic path

---

## 6. IPC Changes

None. No IPC channels are added, removed, or modified.

---

## 7. Test Requirements

Test P04-01: Non-Anthropic provider returns error chunk.

```
- Mock readConfig() to return { apiKey: 'sk-test', provider: 'openai' }
- Call sendChatMessage(messages, onChunk)
- Assert: onChunk was called with { type: 'error', error: string }
- Assert: error message contains 'Anthropic API key'
- Assert: error message contains 'Commandment 15'
```

Test P04-02: Anthropic provider proceeds normally.

```
- Mock readConfig() to return { apiKey: 'sk-ant-test', provider: 'anthropic' }
- Mock Anthropic SDK to return a simple text response
- Call sendChatMessage(messages, onChunk)
- Assert: onChunk was called with { type: 'text', ... } and { type: 'done' }
- Assert: onChunk was NOT called with { type: 'error' }
```

Test P04-03: Gemini provider returns error chunk.

```
- Mock readConfig() to return { apiKey: 'gm-test', provider: 'gemini' }
- Call sendChatMessage(messages, onChunk)
- Assert: onChunk was called with { type: 'error', error: string }
```

Test P04-04: Missing provider defaults to Anthropic (no error).

```
- Mock readConfig() to return { apiKey: 'sk-ant-test' } (no provider field)
- Mock Anthropic SDK
- Call sendChatMessage(messages, onChunk)
- Assert: onChunk was NOT called with { type: 'error' }
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|--------------|
| 15 | Granular AST Tools Only | Yes | The only remaining active code path (Anthropic) enforces tool-use via BRIDGE_TOOLS. Non-Anthropic paths are blocked. |
| 16 | In-Memory Validation Loop | Yes | The only remaining active code path validates tool_use outputs in-memory before surfacing. |
| 8 | Audit-First Execution | Tangential | Complexity routing still applies within the Anthropic path. |

---

## 9. Risk Assessment

**Overall Risk:** LOW

| Risk | Severity | Mitigation |
|------|----------|------------|
| Users with OpenAI/Gemini keys cannot use Bridge AI | Medium | This is the intended outcome. The error message is clear and actionable: "configure an Anthropic API key." Users retain full Glass observability; only the AI chat path is gated. |
| Team pushback on removing provider options | Low | The removed providers provided zero governance value. Document Option A as the future path for provider parity when demand justifies the effort. |
| OpenAI/Gemini code removal breaks imports | Very Low | The `openai` and `@google/genai` packages are dynamically imported (`await import('openai')`). Removing the branches does not affect the module resolution of the remaining code. The packages can remain in `package.json` for the future Option A sprint. |

---

## 10. Acceptance Criteria

- [ ] `sendChatMessage()` rejects `provider: 'openai'` with a clear error chunk
- [ ] `sendChatMessage()` rejects `provider: 'gemini'` with a clear error chunk
- [ ] `sendChatMessage()` accepts `provider: 'anthropic'` (or undefined/missing provider) and proceeds to tool-use flow
- [ ] Error message references Commandments 15 and 16 by name
- [ ] The OpenAI and Gemini branches are removed or clearly marked as dead code with a TODO comment
- [ ] Tests P04-01 through P04-04 pass
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Full test suite passes with 0 regressions
