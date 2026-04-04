# Glass-IDE Seamless Handshake Plan

**Date:** 2026-04-03
**Phase ID:** RELAY.1
**Citadel Name:** **Herald** -- "The messenger between Glass and the IDE"
**Status:** PLAN (Phase 0 -- Architectural Design)

---

## Problem Statement

A designer using Flint Glass sees violations in the Governance Dashboard -- design drifts, accessibility gaps, blocked exports. But acting on those violations requires a mental context switch: open the IDE, remember which file and which violations exist, then manually ask their AI assistant to "fix the violations in my component." The Beacon infrastructure (`useContextSync` writing to `.flint/context.json`, `ContextPushManager` watching for changes, `flint://session-context` resource) already bridges the data gap -- the MCP server *can* see everything Glass sees. What is missing is the *handshake UX*: explicit affordances in Glass that make the IDE feel like a continuation of the same workspace, and automatic context framing in the MCP layer that lets the AI assistant act on Glass state without the designer having to describe it.

---

## Proposed Solution Overview

Three layers, deliberately minimal, respecting Glass's read-only observability role:

1. **Herald Prompt (Glass-side):** A clipboard-based "Hand off to IDE" affordance on violation surfaces. One click copies a pre-composed natural-language prompt (e.g., "Fix the 3 design drift violations in `src/components/Header.tsx`") to the clipboard. The designer pastes it into their IDE chat. No deep links, no protocol handlers -- clipboard is the universal handshake that works with Claude Code, Cursor, VS Code Copilot, and any future MCP host.

2. **Herald Context Frame (MCP-side):** When `flint_get_context` or `flint://session-context` is read, include a new `suggestedAction` field -- a structured object that tells the AI assistant exactly what Glass recommends doing next, based on the current violation state. This turns the on-demand context read into an *actionable briefing* rather than raw data. The MCP prompt `flint-workflow-guide` can reference this field to auto-frame the conversation.

3. **Herald Presence (Glass StatusBar):** Show the MCP connection as an explicit "IDE Connected" / "IDE Disconnected" signal with the connected host name (Claude Code, Cursor, etc.) when detectable. This closes the awareness loop -- the designer knows their IDE can see what Glass sees.

---

## What NOT to Build (Scope Guardrails)

- **No chat in Glass.** Glass is observability. Chat lives in the IDE. Herald does not add a chat panel, input field, or message stream to Glass.
- **No custom protocol handlers or deep links.** `flint://` URI schemes would require per-IDE registration and break on every update. Clipboard is universal.
- **No push-to-IDE mechanism.** We do not send messages *to* the IDE chat. The designer initiates the handoff by pasting the prompt. The MCP server's context is already live; the AI assistant reads it when it needs to act.
- **No new IPC channels for Phase 1.** The existing `mcp:status` IPC already tells Glass whether the MCP server is connected. Phase 1 enriches the existing data flow, not the plumbing.
- **No Glass-side auto-fix.** The Autopilot feature already exists for simple fixes. Herald is about the *complex* handoff where the designer wants the AI assistant's judgment.
- **No IDE-specific integrations in Phase 1.** The VS Code extension (`flint-vscode`) already writes `ide-active-file.json`. Herald Phase 2 may enrich this, but Phase 1 is IDE-agnostic.

---

## Detailed Design

### 1. Herald Prompt (Glass UI Changes)

**Location:** Three surfaces where violations are visible today:

| Surface | Current State | Herald Addition |
|---------|--------------|-----------------|
| GovernanceDashboard next-step text | Shows "say 'fix it' in your IDE" (line 747) | Replace static text with a clickable "Copy fix prompt" chip that writes a structured prompt to clipboard |
| GovernanceDashboard violation rows | Each row shows rule, node, severity | Add a small "Send to IDE" icon button per row that copies a single-violation prompt |
| StatusBar export gate chip | Shows "N Design Drift Issues" | Clicking when blocked already opens Governance tab (line 524-526) -- no change needed |

**Prompt Template Format:**

```
Fix the {count} {category} violation(s) in `{filePath}`:
{bulletList}
Use `flint_fix` with dry_run:true first to preview changes.
```

Example clipboard content:
```
Fix the 3 design drift violations in `src/components/Header.tsx`:
- bg-blue-500 drifts from token brand.primary (Delta-E 4.2)
- text-gray-700 drifts from token neutral.text (Delta-E 3.1)
- shadow-lg has no matching token
Use `flint_fix` with dry_run:true first to preview changes.
```

**Component contract:**

```typescript
// New utility -- src/utils/heraldPrompt.ts

export interface HeraldPromptInput {
  filePath: string
  violations: Array<{
    category: 'design-drift' | 'accessibility' | 'override'
    summary: string  // human-readable one-liner
    nodeId?: string
    severity: 'critical' | 'warning'
  }>
}

export function composeHeraldPrompt(input: HeraldPromptInput): string
```

**UI behavior:**
- Click copies to clipboard, shows a brief "Copied" confirmation (reuse existing `CopySnippet` pattern from GovernanceDashboard line 319-344).
- The chip text changes from "say 'fix it' in your IDE" to "Copy fix prompt" with a clipboard icon.
- When MCP is disconnected (`mcpConnected === false`), the chip changes to "Connect your editor first" and the copy action is disabled.

**Commandment compliance:**
- This is a read-only UI affordance. No mutations, no state changes, no AST ops.
- Does not cross the process boundary (clipboard is a renderer API).
- No new IPC channels needed.

### 2. Herald Context Frame (MCP-side Changes)

**File:** `flint-mcp/src/core/sessionContext.ts`

Add a `suggestedAction` field to the `SessionContext` type and assembly logic:

```typescript
// Addition to flint-mcp/src/types.ts

export interface SuggestedAction {
  /** What the AI assistant should do next */
  action: 'fix-violations' | 'review-overrides' | 'run-audit' | 'none'
  /** Human-readable sentence for the AI to use as framing */
  summary: string
  /** The MCP tool to call */
  tool: string | null
  /** Pre-filled tool arguments */
  toolArgs: Record<string, unknown> | null
  /** Priority: higher = more urgent */
  priority: 'high' | 'medium' | 'low'
}
```

**Assembly logic** (in `assembleSessionContext`):

```
if exportBlocked AND criticalCount > 0:
  action = fix-violations, tool = flint_fix, priority = high
  summary = "Glass shows {N} critical violations blocking export in {file}. Run flint_fix to resolve."

if exportBlocked AND criticalCount === 0:
  action = fix-violations, tool = flint_fix, priority = medium
  summary = "Glass shows {N} violations in {file}. Run flint_fix with dry_run:true to preview fixes."

if overrideCount > 0 AND violationCount === 0:
  action = review-overrides, tool = null, priority = low
  summary = "{N} rule overrides are active. Review them to restore full compliance."

else:
  action = none, summary = "No action needed -- design system is in sync.", priority = low
```

This field is read by any MCP client (Claude Code, Cursor, etc.) when they call `flint_get_context` or read `flint://session-context`. It gives the AI assistant a pre-framed action without the designer having to describe the situation.

**File:** `flint-mcp/src/core/contextPush.ts`

Add `suggestedAction` to the `ContextDelta` so push notifications include it. When the suggested action *changes* (e.g., violations go from 0 to 5), fire a `suggested-action-changed` delta trigger. This lets MCP clients that support notifications receive proactive framing.

### 3. Herald Presence (StatusBar Enhancement)

**File:** `src/components/editor/StatusBar.tsx`

The StatusBar already polls `mcp:status` every 5 seconds (line 148-156). Currently it shows nothing when connected and a reconnection banner when disconnected (line 466-504).

**Phase 1 change:** Add a subtle "IDE Connected" indicator in the StatusBar's right zone:

```
[Export Ready]  ...center...  [IDE: Connected] [Figma] [Breakpoint]
```

- When `mcpConnected === true`: Show `MessageSquare` icon (already imported) + "IDE" in emerald text.
- When `mcpConnected === false`: Show the icon in zinc/gray with "IDE: Offline" and a tooltip explaining how to connect.
- When `mcpConnected === null` (polling): Show nothing (avoid flash of "Offline" on startup).

**Phase 2 enhancement (future):** Enrich `mcp:status` IPC response to include the client name (e.g., "Claude Code", "Cursor") by reading the MCP client's `clientInfo` from the transport layer. Display as "IDE: Claude Code" when available.

---

## IPC Contract

**No new IPC channels in Phase 1.**

Existing channels used:
| Channel | Direction | Current Use | Herald Use |
|---------|-----------|-------------|------------|
| `mcp:status` | renderer -> main | Returns `{ connected: boolean }` | Same -- drives Herald Presence indicator |
| `syncContext` | renderer -> main | Writes FlintContext to `.flint/context.json` | Same -- already includes violation data that Herald Prompt reads from store |

**Phase 2 potential addition:**
| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `mcp:client-info` | renderer -> main | `void` | `{ clientName: string \| null, clientVersion: string \| null }` |

This would read the MCP server's connected client metadata. Only needed if we want to show "IDE: Claude Code" instead of just "IDE: Connected."

---

## Store Contract

**No new store slices.** Herald reads from existing stores:

| Store | State Read | Purpose |
|-------|-----------|---------|
| `canvasStore` | `mithrilViolations`, `a11yViolations`, `overridesExist`, `activeFilePath` | Build the Herald prompt content |
| `editorStore` | `linterWarnings` | Detailed violation list for per-row prompts |
| `canvasStore` (via StatusBar) | (none new) | MCP status already tracked in StatusBar local state |

---

## Component Contract

| Component | Change | Store Dependencies | IPC Calls |
|-----------|--------|-------------------|-----------|
| `GovernanceDashboard.tsx` | Replace "say 'fix it' in your IDE" with `HeraldPromptChip` | `canvasStore.activeFilePath`, `editorStore.linterWarnings` | None |
| `GovernanceDashboard.tsx` | Add per-violation-row copy icon | Same | None |
| `StatusBar.tsx` | Add "IDE: Connected/Offline" chip in right zone | None (uses existing local `mcpConnected` state) | None (existing `mcp:status` poll) |
| `src/utils/heraldPrompt.ts` | New pure utility -- composes clipboard text | None | None |
| `flint-mcp/src/types.ts` | Add `SuggestedAction` type | N/A (server-side) | N/A |
| `flint-mcp/src/core/sessionContext.ts` | Add `suggestedAction` to `SessionContext` assembly | N/A | N/A |

---

## Commandment Checklist

| # | Commandment | Applies? | How Satisfied |
|---|------------|----------|---------------|
| 1 | Code is Truth | No | Herald is read-only UI -- no mutations |
| 4 | Local-First Only | Yes | Clipboard API is local. No external URLs. MCP context is file-based. |
| 9 | CIEDE2000 | Yes (indirectly) | Herald prompts include Delta-E values from existing linter data |
| 12 | Atomic Queuing | No | No file writes from Glass side |
| 13 | Deterministic Surgery | No | No AST ops |

---

## Implementation Order

### Phase 1: Herald Core (2 parallel tracks)

**Track A -- Glass UI** (owner: `flint-design-engineer`)
1. Create `src/utils/heraldPrompt.ts` -- pure function, fully testable
2. Create `src/utils/__tests__/heraldPrompt.test.ts` -- test prompt composition for 0, 1, N violations, mixed categories
3. Modify `GovernanceDashboard.tsx` -- replace static "say 'fix it'" text with `HeraldPromptChip` using the compose function
4. Modify `GovernanceDashboard.tsx` -- add per-row copy icon on violation list items
5. Modify `StatusBar.tsx` -- add "IDE: Connected/Offline" chip in right zone
6. Tests for StatusBar and GovernanceDashboard changes

**Track B -- MCP Context Frame** (owner: `flint-ast-surgeon` or MCP specialist)
1. Add `SuggestedAction` type to `flint-mcp/src/types.ts`
2. Add `suggestedAction` assembly logic to `flint-mcp/src/core/sessionContext.ts`
3. Add `suggested-action-changed` trigger to `flint-mcp/src/core/contextPush.ts`
4. Tests for all three files

**Tracks A and B are fully independent** -- no shared files, no ordering dependency.

### Phase 2: Herald Enrichment (future, not in this sprint)

1. `mcp:client-info` IPC channel -- show connected client name in StatusBar
2. VS Code extension enrichment -- `flint-vscode` writes `ide-client-info.json` with editor name/version
3. MCP prompt integration -- `flint-workflow-guide` references `suggestedAction` to auto-frame conversations
4. Command Palette integration -- add "Copy fix prompt for IDE" as a palette command

---

## Risks

| Risk | Severity | Commandment Threatened | Mitigation |
|------|----------|----------------------|------------|
| Clipboard prompt becomes stale if violations change between copy and paste | Low | None | Prompt includes file path -- the MCP context read at paste time will have fresh data. The prompt is a *starting point*, not a binding instruction. |
| `suggestedAction` adds latency to `flint_get_context` | Low | None | Assembly is a simple conditional on already-computed fields. Sub-1ms. |
| Designers ignore the "Copy fix prompt" chip | Medium | None | Mitigated by making it the *primary* next-step affordance, replacing passive text with an active button. If adoption is low, Phase 2 can explore auto-framing via the MCP prompt layer. |
| MCP clients that don't read `suggestedAction` get no benefit | Low | None | The field is additive. Existing behavior (manual `flint_get_context` calls) still works. The prompt template in the clipboard is the primary handshake mechanism -- it works with any chat interface. |

---

## Success Criteria

1. A designer seeing violations in GovernanceDashboard can copy a ready-to-paste prompt in one click.
2. An AI assistant calling `flint_get_context` receives a `suggestedAction` that tells it exactly what to do next without the human describing the situation.
3. The StatusBar shows whether the IDE connection is live, closing the awareness gap.
4. Zero new IPC channels. Zero new store slices. Zero new process boundary crossings.
5. The entire Phase 1 implementation touches 7 files (2 new, 5 modified) and can be built and tested by two parallel agents in one sprint.
