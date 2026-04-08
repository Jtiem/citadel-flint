# IDE Chat UX → A+ Spec

**Date:** 2026-04-07
**Author:** Justin Tiemann + Claude
**Status:** DRAFT — awaiting approval

---

## Problem Statement

Flint's IDE chat experience (how users interact with governance tools through Claude Code, Cursor, or VS Code) is a **B+**. The governance engine is world-class, but the conversational surface has two gaps:

1. **Chat polish** — tool descriptions use jargon, cold-start gives no breadcrumbs, some responses dump raw JSON
2. **Error visibility** — 318+ error paths swallow context, making development slower and making it harder for the LLM to help users recover

This spec addresses both.

---

## Part 1: Chat Polish (5 Fixes)

### Fix 1: Humanize Tool Descriptions

**Where:** `flint-mcp/src/server.ts` (ListToolsRequestSchema handler)

Rewrite 8 jargon-heavy tool descriptions to plain English. The audience is a designer or developer who has never seen Flint before.

| Tool | Current Description | Proposed Description |
|------|-------------------|---------------------|
| `flint_ast_mutate` | "Apply a batch of structural mutations to a file AST. Supported types: move, inject, fixToken..." | "Make code changes safely — move elements, inject components, fix tokens, update props, and more. This is the only approved way to modify code." |
| `flint_mutation_provenance` | "Query the mutation provenance ledger. Returns who or what caused each AST mutation..." | "See who changed each piece of code and why — track human edits, auto-fixes, imports, and AI agent actions." |
| `flint_anomaly_report` | "Detect statistical anomalies in governance data (3-sigma threshold)..." | "Spot unusual patterns — spikes in overrides, sudden violation surges, or agents behaving differently than normal." |
| `flint_risk_score` | "Compute mutation risk scores (0-100, 5-factor weighted)..." | "Check how risky a code change is (0-100 score). Can score a single change, a file, or the whole project." |
| `flint_consensus_report` | "Query the epistemic consensus gate records..." | "Check whether AI agents are agreeing or disagreeing on code safety. High disagreement = something needs human review." |
| `flint_query_registry` | "Searches the Flint UI component registry using both vector semantic search and text relevance..." | "Find existing components in your design system. Returns matching components with TypeScript interfaces and import paths." |
| `flint_override_telemetry` | "Query override telemetry. Returns every governance rule bypass, disable, or severity downgrade..." | "See which governance rules have been bypassed or turned down, and by whom. Useful for compliance reviews." |
| `flint_agent_risk` | "Query per-agent risk profiles — mutation counts, average risk scores, red/amber/green tier breakdown..." | "Check an AI agent's safety track record — how many changes it's made, its risk score, and whether it's been flagged." |

**Acceptance criteria:**
- All 54 tool descriptions reviewed
- Any description using "AST", "ledger", "sigma", "epistemic", "structural mutation", or "telemetry" without context gets rewritten
- Technical terms are OK if they're explained inline (e.g., "risk score (0-100)")

---

### Fix 2: Cold-Start Welcome Message

**Where:** `flint-mcp/src/server.ts` → `flint_status` handler

**Current:**
```
Flint Protocol Active: Standalone Mode. Mithril, A11y, Figma Hydration, and AST Mutation engines ready.
```

**Proposed:**
```
Flint governance engine active — 54 tools ready.

Quick start:
• 'audit my component' — scan a file for violations
• 'fix it' — auto-remediate detected violations
• 'check accessibility' — WCAG 2.1 AA compliance
• 'show health' — design debt score and grade
• 'what can you do?' — full capability tour

New here? Say 'onboard my project' to get set up.
```

**Why:** First impressions matter. The current message tells you the engine is running but gives zero guidance on what to do next. The proposed version is a launchpad.

**Acceptance criteria:**
- `flint_status` response includes quick-start actions
- Actions are natural language (what users would actually type), not tool names

---

### Fix 3: Intro Sentences on JSON Responses

**Where:** `flint-mcp/src/server.ts` → `flint_get_context` handler, `flint://session-context` resource

**Current:** Raw `JSON.stringify(sessionCtx, null, 2)` — a wall of JSON with no context.

**Proposed:** Prepend a plain-English summary line before the JSON:

```
Project: {projectName} | Health: {grade} ({score}/100) | {violationCount} open violations | Active file: {activeFile}

{JSON data}
```

**Apply the same pattern to:**
- `flint://session-context` resource
- `flint://dashboard` resource
- `flint://agent-risk` resource
- `flint://anomalies` resource

**Acceptance criteria:**
- Every resource that returns JSON gets a 1-line human-readable summary prepended
- Summary extracts the 3-4 most important fields from the payload
- JSON is still present and parseable (summary is on its own line, separated by blank line)

---

### Fix 4: Surface Silent Failures

**Where:** All tool handlers in `flint-mcp/src/server.ts` and `flint-mcp/src/tools/`

**Current:** When a dependent operation fails (manifest parse, registry lookup, token load), the error is caught and swallowed. The response looks normal but is missing data.

**Proposed:** Add a `warnings` array to tool responses when operations are partially skipped:

```json
{
  "summary": "Found 3 violations in Banner.tsx — 2 auto-fixable.",
  "warnings": [
    "Component registry unavailable — registry membership check skipped. Run flint_reindex_registry to rebuild.",
    "design-tokens.json could not be parsed — token coverage not included."
  ],
  "violations": [...]
}
```

**Target locations (highest impact):**

| File | Line | Silent Failure | Proposed Warning |
|------|------|---------------|-----------------|
| `server.ts` | ~1749 | design-tokens.json parse fails | "Token file couldn't be read — token coverage skipped. Check .flint/design-tokens.json." |
| `server.ts` | ~1769 | manifest parse fails | "Component registry unavailable — run flint_reindex_registry to rebuild." |
| `server.ts` | ~2354 | RAG search fails, falls back | "Semantic search unavailable — results are from keyword matching only." |
| `audit.ts` | catch blocks | Various audit sub-steps fail | "Partial audit: {step} was skipped due to {reason}." |

**Acceptance criteria:**
- All `catch` blocks in MCP tool handlers that silently degrade behavior now append to a `warnings` array
- Warnings are plain English with an actionable recovery step
- Warnings appear in the tool response (visible to the LLM), not just console.log

---

### Fix 5: Error Recovery Breadcrumbs

**Where:** All `isError: true` responses across `flint-mcp/src/server.ts` and tool handlers

**Current:** Most error responses include only `err.message` — e.g., "File not found: Banner.tsx"

**Proposed:** Every error response includes three parts:
1. **What happened** (the error)
2. **Why it might have happened** (common causes)
3. **What to try** (recovery steps)

**Template:**
```
{tool_name} failed: {error_message}

Common causes:
• {cause_1}
• {cause_2}

Try:
• {recovery_step_1}
• {recovery_step_2}
```

**Example — file not found:**
```
audit_ui_component failed: File not found — src/components/Banner.tsx

Common causes:
• The file path is relative — try the full path from project root
• The file was recently renamed or moved

Try:
• Check the exact path: flint_get_context shows your active file
• Use a glob pattern with flint_swarm_audit_fix to find it
```

**Priority error responses to improve (top 10 by frequency):**

| Error | Current Message | Needs |
|-------|----------------|-------|
| File not found | "File not found: {path}" | Path suggestions, glob hint |
| Missing parameter | "{tool}: '{param}' is required" | Example usage, default hint |
| Parse error | "Parsing Error: {msg}" | Which file, what format expected |
| No tokens found | "No design tokens" | How to create/import tokens |
| Library not set | "Library auto-detection inconclusive" | How to set library |
| No Figma connection | "Not connected to Figma" | How to connect |
| Sync conflict | "Conflicts exist" | How to resolve |
| Policy not found | "No policy file" | How to create one |
| Registry empty | "No components indexed" | How to seed registry |
| Audit timeout | (no message) | File size hint, batch suggestion |

**Acceptance criteria:**
- All `isError: true` responses include "Common causes" and "Try" sections
- Recovery steps reference specific Flint tools by name
- No error is a dead end

---

## Part 2: Development Error Visibility

### The Problem

318+ error paths in the codebase swallow, strip, or lose error context. This slows down development (we debug by guessing) and degrades the chat experience (the LLM can't help users recover from errors it can't see).

### The Approach

We are NOT building a logging framework. We're making targeted fixes to the highest-impact error paths so that:
1. **During development**, errors surface clearly in the terminal
2. **In chat**, the LLM gets enough context to help users recover
3. **In production**, the app still degrades gracefully (no crashes)

### Sprint 1: Critical Error Paths (highest impact, lowest effort)

#### 1A: MCP Tool Error Enrichment

**Where:** `flint-mcp/src/server.ts` — all `catch` blocks in tool handlers (~50 locations)

**Change:** Replace the pattern:
```typescript
catch (err: unknown) {
  return { isError: true, content: [{ type: "text", text: `${toolName} failed: ${(err as Error).message}` }] };
}
```

With a helper that preserves context:
```typescript
// flint-mcp/src/core/errorResponse.ts
export function toolError(toolName: string, err: unknown, hints?: { causes?: string[], recovery?: string[] }): ToolResponse {
  const error = err instanceof Error ? err : new Error(String(err));
  const parts = [`${toolName} failed: ${error.message}`];

  if (hints?.causes?.length) {
    parts.push('', 'Common causes:', ...hints.causes.map(c => `• ${c}`));
  }
  if (hints?.recovery?.length) {
    parts.push('', 'Try:', ...hints.recovery.map(r => `• ${r}`));
  }

  // Always log full stack during development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${toolName}]`, error.stack || error.message);
  }

  return {
    isError: true,
    content: [{ type: "text", text: parts.join('\n') }],
  };
}
```

**Acceptance criteria:**
- Every MCP tool `catch` block uses `toolError()` instead of inline formatting
- Stack traces appear in dev terminal but not in chat responses
- At least the top 10 most common errors have custom `causes` and `recovery` hints

#### 1B: Silent Catch Audit

**Where:** All files with `catch(() => {})` or `catch { /* best-effort */ }` patterns

**Change:** Replace silent catches with `console.warn` + optional `warnings` accumulation:

| Priority | File | Silent Catch | Fix |
|----------|------|-------------|-----|
| P0 | `server/index.ts:912` | MCP startup silently fails | `console.error` + return error to client |
| P0 | `electron/preview/viteServer.ts:122` | Vite preview load silently fails | `console.error` + surface in LivePreview |
| P1 | `src/components/ui/GovernanceDashboard.tsx` (×3) | Dashboard data loads silently fail | `console.warn` + show "data unavailable" in UI |
| P1 | `src/hooks/useContrastAudit.ts:42` | Contrast audit silently fails | `console.warn` + skip gracefully with note |
| P2 | `src/App.tsx` (×2) | App-level catches | `console.warn` (keep graceful degradation) |
| P2 | `src/components/ui/ExportModal.tsx` (×4) | Export sub-checks fail silently | `console.warn` + add to export warnings |
| P2 | 65+ other "best-effort" catches | Various | Add `console.warn` with context string |

**Rule:** No catch block should be completely empty. Minimum is `console.warn('[Flint] {context}: {error}')`. The app should still keep running — we're adding visibility, not crash-on-error.

**Acceptance criteria:**
- Zero empty `catch(() => {})` blocks remain
- Every catch has at minimum a `console.warn` with identifying context
- P0 items surface errors to the user (not just console)

#### 1C: IPC Error Propagation

**Where:** `electron/main.ts` — IPC handlers that swallow errors

**Change:** Ensure errors in IPC handlers propagate back to the renderer:

```typescript
// BEFORE (error swallowed)
ipcMain.handle('ast:save-file', async (_event, filePath, content) => {
  // ... save logic ...
  await gitManager.shadowCommit(path.dirname(filePath)).catch((err) => {
    console.error('shadowCommit failed', err);
    // caller thinks save succeeded!
  });
});

// AFTER (error surfaced)
ipcMain.handle('ast:save-file', async (_event, filePath, content) => {
  // ... save logic ...
  try {
    await gitManager.shadowCommit(path.dirname(filePath));
  } catch (err) {
    console.error('[Flint] shadowCommit failed:', err);
    // Save succeeded, but commit didn't — surface as warning, not failure
    return { success: true, warning: 'File saved but version snapshot failed. Your changes are safe.' };
  }
});
```

**Target:** 10 IPC handlers where errors are caught but not returned to renderer.

**Acceptance criteria:**
- Every IPC handler either throws (Electron propagates to renderer) or returns an explicit error/warning shape
- No IPC handler has a catch block that logs and continues without signaling the renderer

### Sprint 2: Store & UI Error Surfaces (medium effort)

#### 2A: Store Error Patterns

**Where:** `src/store/tokenStore.ts`, `src/store/canvasStore.ts`, `src/store/orchestratorStore.ts`

**Change:** Replace `set({ error: String(err) })` with proper error objects:

```typescript
// BEFORE
catch (err) {
  set({ error: String(err) })  // might be "[object Object]"
}

// AFTER
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  set({ error: message });
  console.warn('[Flint] Token operation failed:', message);
}
```

**Also fix:** Optimistic updates without rollback in `tokenStore.deleteToken` — if the IPC call fails, restore the token to the list.

#### 2B: Notification Integration

**Where:** `src/store/notificationStore.ts` + key error sites

For P0/P1 errors that affect the user's workflow, surface a toast notification instead of (or in addition to) console logging:

```typescript
// In components/hooks that catch errors:
import { useNotificationStore } from '@/store/notificationStore';

// When MCP startup fails, governance dashboard can't load, etc:
notificationStore.getState().addNotification({
  type: 'warning',
  title: 'Governance data unavailable',
  message: 'Could not load health score. Try refreshing the panel.',
});
```

**Target:** Only the 5-8 errors that directly affect what the user sees in Glass. Not every console.warn needs a toast.

---

## Scope & Prioritization

| Item | Sprint | Effort | Impact |
|------|--------|--------|--------|
| Fix 1: Humanize tool descriptions | 1 | Small | High — first impressions |
| Fix 2: Cold-start welcome | 1 | Small | High — onboarding |
| Fix 3: Intro sentences on JSON | 1 | Small | Medium — readability |
| Fix 4: Surface silent failures (warnings array) | 1 | Medium | High — trust |
| Fix 5: Error recovery breadcrumbs | 1 | Medium | High — self-service |
| 1A: MCP toolError() helper | 1 | Medium | High — dev speed + chat quality |
| 1B: Silent catch audit | 1 | Medium | High — dev speed |
| 1C: IPC error propagation | 1 | Medium | High — correctness |
| 2A: Store error patterns | 2 | Small | Medium — UI reliability |
| 2B: Notification integration | 2 | Small | Medium — user awareness |

**Sprint 1** = Chat polish + critical error paths (everything needed for A+ chat UX)
**Sprint 2** = Glass-side error surfaces (better for us during development)

---

## What This Does NOT Include

- **Centralized logging service** — not needed yet. Console.warn with context strings is sufficient for our scale.
- **Error tracking/telemetry** — premature until we have beta users generating real error data.
- **Crash reporting** — separate concern, separate spec.
- **Retry logic** — most failures are config/file issues, not transient. Retrying won't help.

---

## Success Criteria

After implementation:

1. **Chat UX:** A new user can connect to Flint MCP, see what to do, run their first audit, hit an error, and recover — all without leaving chat. No dead ends.
2. **Dev visibility:** When something breaks during development, the terminal tells us what, where, and why within 5 seconds of the failure. No more stacking guesses.
3. **Zero silent failures in MCP tools:** Every tool either succeeds with optional warnings, or fails with causes + recovery steps.
4. **Zero empty catch blocks:** Every error path has at minimum a `console.warn` with context.
