# Contract Artifact: SEC.3 -- MCP Tool Allowlist

**Version:** 1.0
**Date:** 2026-03-16
**Status:** CONTRACT -- Binding specification for Phase 2 agents
**Priority:** P1
**Depends on:** None (no phase dependencies)
**Security Review Ref:** `.flint-context/reviews/SEC-surface-review.md` finding: "MCP tool relay has no allowlist"

---

## 1. Summary

The `mcp:call-tool` IPC handler in `electron/main.ts` currently forwards any tool name from the renderer to the MCP server without restriction. A compromised renderer (e.g., via XSS in the unsandboxed preview iframe -- addressed separately in SEC.1) could invoke destructive MCP tools such as `flint_ast_mutate`, `flint_fix`, `flint_ingest_figma`, or `flint_swarm_audit_fix`.

This contract introduces a static allowlist of renderer-callable MCP tools, enforced server-side in the main process. Only tools that the Glass observability layer legitimately needs are permitted. All other tool invocations from the renderer are rejected with a clear error.

---

## 2. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `electron/mcp-policy.ts` | CREATE | `flint-electron-ipc` | Static allowlist constant |
| `electron/main.ts` | MODIFY | `flint-electron-ipc` | Import allowlist, add guard to `mcp:call-tool` handler |
| `electron/__tests__/mcp-policy.test.ts` | CREATE | `flint-test-writer` | Tests for allowlist enforcement |

---

## 3. Detailed Behavior Specification

### 3.1 Allowlist derivation

The allowlist is derived by auditing every actual `mcp.callTool(...)` call site in the `src/` directory. Current findings:

| Caller | File | Tool Name | Purpose |
|--------|------|-----------|---------|
| `ExportModal.handleDownloadDBOM` | `src/components/ui/ExportModal.tsx:178` | `flint_generate_dbom` | Download Design Bill of Materials as JSON |

That is the **only** direct `callTool` invocation from the renderer. However, the MCP surface also has `readResource` calls (which go through a separate `mcp:read-resource` handler and are out of scope for this contract) and the `onEvent` listener (push-only, no tool invocation).

The allowlist should also include tools that Glass buttons or panels may legitimately invoke now or in the near future based on the module status table in CLAUDE.md. These are read-oriented and low-risk tools:

| Tool | Justification |
|------|--------------|
| `flint_status` | Health check -- used by status indicators |
| `flint_audit` | Run governance audit -- used by GovernanceOverlay and ExportModal pre-flight |
| `flint_debt_report` | Health score data -- used by GovernanceDashboard |
| `flint_query_registry` | Component search -- used by Asset Management Hub |
| `flint_generate_dbom` | DBOM export -- used by ExportModal (the one confirmed callTool site) |
| `flint_accessibility_report` | VPAT report -- used by ExportModal compliance section |
| `flint_audit_report` | Provenance report -- used by ExportModal compliance summary |

Tools explicitly **excluded** from the allowlist (write-oriented or agent-only):

| Tool | Reason for Exclusion |
|------|---------------------|
| `flint_ast_mutate` | AST mutations from the renderer go through `editorStore.applyBatch` -> `ast:save-file` IPC, not through MCP. MCP mutations are agent-initiated and should only come from the host IDE via MCP protocol, not from Glass. |
| `flint_fix` | Auto-fix is triggered by GovernanceOverlay buttons which call `editorStore.applyBatch` directly, not MCP. |
| `flint_ingest_figma` | Ingestion is triggered by the HTTP server route, not by Glass. |
| `flint_sync_tokens` | Token sync is triggered by the ingestion server, not by Glass. |
| `flint_swarm_audit_fix` | Agent-only swarm orchestration tool. Never called from Glass. |
| `flint_add_remote_library` | Agent-only library management. Never called from Glass. |
| `flint_annotate` | Annotations are created by MCP agents via the protocol, not by Glass buttons. Glass reads annotations via `annotations:read-all` IPC, not MCP. |

### 3.2 New file: electron/mcp-policy.ts

**File:** `electron/mcp-policy.ts`

```typescript
/**
 * MCP Tool Allowlist -- electron/mcp-policy.ts
 *
 * Defines which MCP tools the renderer (Glass) is permitted to invoke
 * via the mcp:call-tool IPC channel. Tools not in this list are rejected
 * server-side in the main process.
 *
 * This is a security boundary: Glass is an observability layer and should
 * only call read-oriented or report-generation tools. Write-oriented tools
 * (mutations, fixes, ingestion) are invoked by MCP agents through the
 * protocol, not by the renderer.
 *
 * To add a new tool: append it to RENDERER_ALLOWED_MCP_TOOLS and document
 * the Glass call site that needs it.
 */

/**
 * Frozen set of MCP tool names the renderer is allowed to invoke.
 * Enforced by the mcp:call-tool handler in main.ts.
 */
export const RENDERER_ALLOWED_MCP_TOOLS: readonly string[] = Object.freeze([
    'flint_status',
    'flint_audit',
    'flint_debt_report',
    'flint_query_registry',
    'flint_generate_dbom',
    'flint_accessibility_report',
    'flint_audit_report',
]) as readonly string[]
```

The array is `Object.freeze`-d so it cannot be mutated at runtime. The type is `readonly string[]` to enforce immutability at the type level.

### 3.3 main.ts mcp:call-tool handler modification

**File:** `electron/main.ts`, at the `mcp:call-tool` handler (line 1858-1868)

Add an import at the top of the file:

```typescript
import { RENDERER_ALLOWED_MCP_TOOLS } from './mcp-policy.js'
```

Modify the handler to check the allowlist before forwarding:

```typescript
ipcMain.handle(
    'mcp:call-tool',
    async (_event, name: unknown, args: unknown): Promise<unknown> => {
        if (typeof name !== 'string' || name.length === 0) {
            throw new TypeError('mcp:call-tool -- name must be a non-empty string')
        }
        if (typeof args !== 'object' || args === null || Array.isArray(args)) {
            throw new TypeError('mcp:call-tool -- args must be a plain object')
        }

        // SEC.3: Enforce renderer tool allowlist
        if (!RENDERER_ALLOWED_MCP_TOOLS.includes(name)) {
            throw new Error(
                `mcp:call-tool -- tool "${name}" is not in the renderer allowlist. ` +
                `Only these tools can be called from Glass: ${RENDERER_ALLOWED_MCP_TOOLS.join(', ')}`
            )
        }

        return mcpClient.callTool(name, args as Record<string, unknown>)
    }
)
```

The error message is intentionally descriptive: it tells the developer exactly which tools are permitted, making debugging straightforward during development.

### 3.4 preload.ts -- no changes

The allowlist is enforced server-side in the main process. The preload's `mcp.callTool` surface remains unchanged. The renderer will receive a rejected Promise (thrown Error) when calling a disallowed tool, which is the same error path as any other IPC handler failure.

---

## 4. IPC Changes

| Channel | Direction | Change | Notes |
|---------|-----------|--------|-------|
| `mcp:call-tool` | renderer -> main | Added allowlist validation before forwarding | Disallowed tools throw `Error` with descriptive message |

No new IPC channels. The existing channel gains a pre-forwarding guard.

---

## 5. Store Contracts

None. No Zustand stores are modified.

---

## 6. Component Contracts

None. No React components are modified. The `ExportModal.tsx` call to `flint_generate_dbom` is already in the allowlist and continues to work.

---

## 7. Test Requirements

### 7.1 Policy file tests

**File:** `electron/__tests__/mcp-policy.test.ts`

Test SEC3-01: `RENDERER_ALLOWED_MCP_TOOLS` is a frozen array.

```
- Import RENDERER_ALLOWED_MCP_TOOLS
- Assert: Object.isFrozen(RENDERER_ALLOWED_MCP_TOOLS) === true
- Assert: Array.isArray(RENDERER_ALLOWED_MCP_TOOLS) === true
- Assert: RENDERER_ALLOWED_MCP_TOOLS.length > 0
```

Test SEC3-02: The allowlist contains the expected tools.

```
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_status'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_audit'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_debt_report'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_query_registry'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_generate_dbom'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_accessibility_report'
- Assert: RENDERER_ALLOWED_MCP_TOOLS includes 'flint_audit_report'
```

Test SEC3-03: The allowlist does NOT contain write-oriented tools.

```
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_ast_mutate'
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_fix'
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_ingest_figma'
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_sync_tokens'
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_swarm_audit_fix'
- Assert: RENDERER_ALLOWED_MCP_TOOLS does NOT include 'flint_add_remote_library'
```

### 7.2 Handler enforcement tests

These tests require mocking the `mcp:call-tool` IPC handler or testing the validation logic in isolation.

Test SEC3-04: Allowed tool passes through to mcpClient.

```
- Mock mcpClient.callTool to return { content: [{ type: 'text', text: 'ok' }] }
- Invoke the mcp:call-tool handler with name='flint_status', args={}
- Assert: mcpClient.callTool was called with ('flint_status', {})
- Assert: result matches the mock return value
```

Test SEC3-05: Disallowed tool is rejected with descriptive error.

```
- Invoke the mcp:call-tool handler with name='flint_ast_mutate', args={}
- Assert: the call throws/rejects
- Assert: error message contains 'not in the renderer allowlist'
- Assert: error message contains 'flint_ast_mutate'
- Assert: mcpClient.callTool was NOT called
```

Test SEC3-06: Unknown tool (not in MCP server at all) is rejected.

```
- Invoke the mcp:call-tool handler with name='nonexistent_tool', args={}
- Assert: the call throws/rejects
- Assert: error message contains 'not in the renderer allowlist'
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|--------------|
| 4 | Local-First Only | Yes | No external network calls introduced. Allowlist is a static constant. |
| 15 | Granular AST Tools Only | Tangential | This contract does not modify the AI orchestrator's tool catalog. It restricts which tools the *renderer* can invoke via IPC, which is a different boundary. The orchestrator continues to use its own tool catalog (Commandment 15) via the Anthropic SDK directly. |

---

## 9. Implementation Order

| Step | Agent | Parallel Group | Description |
|------|-------|---------------|-------------|
| 1 | `flint-electron-ipc` | A | Create `electron/mcp-policy.ts` with the allowlist |
| 2 | `flint-electron-ipc` | A | Modify `electron/main.ts`: import allowlist, add guard to `mcp:call-tool` |
| 3 | `flint-test-writer` | B (after A) | Write tests SEC3-01 through SEC3-06 |
| 4 | `flint-test-writer` | B | Run full test suite, TSC, report counts |

Steps 1+2 can run in parallel (same agent, but they touch different files). Tests run after.

---

## 10. Risk Assessment

**Overall Risk:** LOW

| Risk | Severity | Mitigation |
|------|----------|------------|
| Allowlist blocks a legitimate Glass feature added later | Low | The error message explicitly lists allowed tools. Adding a new tool to the allowlist is a one-line change in `mcp-policy.ts`. |
| `ExportModal` DBOM download breaks | Very Low | `flint_generate_dbom` is explicitly in the allowlist. Verified via grep. |
| Future Glass features need write tools | Medium | If a future Glass feature needs to invoke `flint_fix` or `flint_ast_mutate` from a button click, the allowlist must be expanded. This is intentional friction: each addition requires a conscious security decision. For write-oriented tools, consider adding a user-confirmation dialog in the main process (future SEC enhancement). |

---

## 11. Acceptance Criteria

- [ ] `electron/mcp-policy.ts` exists and exports `RENDERER_ALLOWED_MCP_TOOLS`
- [ ] The array is frozen (`Object.isFrozen` returns true)
- [ ] The array contains exactly: `flint_status`, `flint_audit`, `flint_debt_report`, `flint_query_registry`, `flint_generate_dbom`, `flint_accessibility_report`, `flint_audit_report`
- [ ] `mcp:call-tool` handler rejects tool names not in the allowlist
- [ ] Rejection error message is descriptive (includes tool name and list of allowed tools)
- [ ] `ExportModal` DBOM download continues to work
- [ ] Tests SEC3-01 through SEC3-06 pass
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Full test suite passes with 0 regressions
