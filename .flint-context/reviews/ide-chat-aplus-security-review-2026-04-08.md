# Security Review: IDE Chat UX A+ Sprint 1 & Sprint 2
**Date:** 2026-04-08
**Reviewer:** Security Review Agent
**Verdict:** ADVISORY (no critical issues; two medium findings, one low finding)

---

## Scope

Files reviewed:
- `flint-mcp/src/core/errorResponse.ts`
- `flint-mcp/src/server.ts` (toolError call sites)
- `src/adapters/web-api.ts` (ws.onerror, notifyMcpOffline)
- `src/components/ui/GovernanceDashboard.tsx` (toast calls)
- `src/components/ui/ExportModal.tsx` (toast calls)
- `src/store/tokenStore.ts` (error state)
- `electron/main.ts` and `server/index.ts` (IPC error propagation)

---

## Findings

### MEDIUM-1: Raw error messages forwarded into user-visible toasts (GovernanceDashboard, ExportModal)

**Severity:** Medium
**Files:** `src/components/ui/GovernanceDashboard.tsx` lines 910–915, 1056–1060, 1379–1383; `src/components/ui/ExportModal.tsx` lines 295–299

In four places, `err.message` or `String(err)` is forwarded directly into toast notification `message` fields without sanitisation:

```ts
// GovernanceDashboard.tsx ~line 915
message: `Could not run the audit — ${msg}`,

// GovernanceDashboard.tsx ~line 1060
message: `Fix failed — ${msg}`,

// GovernanceDashboard.tsx ~line 1383
message: msg,

// ExportModal.tsx ~line 299
message: msg,
```

The underlying error may originate from:
1. The MCP server, which can surface error messages containing full absolute file paths (e.g. `File not found: /Users/tiemann/my-project/src/Button.tsx`) — confirmed in `server.ts` lines 1520, 1764, 1917, 1966, 2318, 2360.
2. The Express/IPC layer in `server/index.ts`, which returns `err.message` or `String(err)` verbatim in several handlers (lines 2232, 2688, 2791, 2854, 2973, 2994).
3. Node.js filesystem errors, which include absolute paths in their default messages (e.g. `ENOENT: no such file or directory, open '/Users/tiemann/...'`).

**Impact:** File system paths shown in toasts leak the user's OS username, home directory structure, and internal project layout. While this is the user's own data, it is unnecessary information exposure in the UI layer. More importantly, if the error originates from a malicious or unexpected input (e.g. a Figma payload containing a crafted string that causes an exception), the raw exception text reaches the toast renderer without filtering.

**No prompt injection risk in the current implementation** — toast messages are rendered as plain React text nodes, not as HTML or evaluated content. The LLM never reads toast content directly in the current architecture. However, if toast content is ever included in context sent to the AI (e.g. a future Beacon sync), this path would become a prompt injection vector.

**Recommendation:**
Create a `sanitiseToastMessage(msg: string): string` utility that:
1. Strips absolute paths (replace with just the filename: `path.basename`).
2. Caps message length at ~120 characters.
3. Applies before any `err.message` is placed in a toast `message` field.

Example:
```ts
function sanitiseToastMessage(raw: string): string {
  // Replace absolute paths with just the filename
  return raw
    .replace(/\/[^\s"']+\.(tsx?|jsx?|json|yaml|css)/g, (m) => path.basename(m))
    .slice(0, 120)
}
```

---

### MEDIUM-2: `audit_ui_component` error includes full resolved path in MCP chat response

**Severity:** Medium
**File:** `flint-mcp/src/server.ts` line 1764

```ts
return toolError("audit_ui_component", new Error(`File not found: ${componentPath}`), HINTS.fileNotFound);
```

`componentPath` is a resolved absolute path (line 1761: `path.resolve(process.cwd(), file ?? '')`). This path is placed directly into the MCP tool error text that is sent to the LLM as a chat response.

For example, the LLM would receive: `audit_ui_component failed: File not found: /Users/tiemann/Lunar-Elevator-Bridge/src/components/Button.tsx`

**Impact:** The LLM now has the user's absolute home directory path, OS username, and project layout in its context. This is an information disclosure to a third-party AI service (Anthropic's API). For most users this is low-risk, but it violates the principle of minimal disclosure, and the resolved path adds no recovery value over the basename alone.

**Note:** The same pattern appears in the violations resource handler (`server.ts` line 1520) and several `throw new Error(...)` calls at lines 1917, 1966, 2318, 2360 — those use `throw` rather than `toolError`, so they bubble up as unstructured exceptions rather than structured chat responses.

**Recommendation:**
In `toolError` calls where the error originates from a "file not found" check, pass only `path.basename(componentPath)` in the error message:

```ts
return toolError(
  "audit_ui_component",
  new Error(`File not found: ${path.basename(componentPath)}`),
  HINTS.fileNotFound
);
```

The HINTS.fileNotFound recovery steps already tell the LLM to use the full absolute path, so no recovery value is lost.

---

### LOW-1: `_mcpOfflineToastFired` module-level flag suppresses re-notification across sessions in a single page load

**Severity:** Low
**File:** `src/adapters/web-api.ts` lines 16–27

```ts
let _mcpOfflineToastFired = false

function notifyMcpOffline(): void {
  if (_mcpOfflineToastFired) return
  _mcpOfflineToastFired = true
  // ...
}
```

The flag is module-level and is never reset. In the web build, the page is served as a long-lived SPA. If the WebSocket errors on initial connect (`ws.onerror`) and fires `notifyMcpOffline`, then the server recovers, and then disconnects again hours later, the user will not receive a second toast warning — the flag is permanently set for the lifetime of the page.

This is a UI reliability issue, not a security vulnerability. However, it could prevent the user from knowing the governance engine went offline after a server restart, which could lead to them exporting code without audit protection under a false impression of safety. Given that the Export Gate depends on MCP connectivity, this has a governance integrity implication.

**Recommendation:**
Reset the flag when the WebSocket reconnects successfully:

```ts
ws.onopen = () => {
  _mcpOfflineToastFired = false
}
```

This allows re-notification on the next disconnect after a successful reconnect, without spamming during rapid reconnect attempts.

---

## Items Confirmed Clean

**1. Stack trace gating — PASS**
`errorResponse.ts` line 43–45 gates `error.stack` strictly on `process.env.NODE_ENV !== "production"` and writes only to `console.error`. The stack is never included in the `content` array returned to the LLM. This is correctly implemented.

**2. HINTS content — PASS**
All HINTS entries use generic placeholders (`/path/to/file.tsx`), not real paths. Recovery steps reference MCP tool names only. No sensitive configuration details, API keys, or internal URLs are present.

**3. Toast messages in GovernanceDashboard — mostly PASS with caveat**
Most toasts use hardcoded strings that contain no sensitive data. The caveat is MEDIUM-1 above (the four cases where `err.message` flows in directly).

**4. tokenStore error state — PASS**
`tokenStore.ts` stores `err.message` in Zustand state (`error` field) but does not push it to a toast. The error is rendered only in the TokenPanel UI where it is contextually appropriate.

**5. MCP offline toast content — PASS**
`notifyMcpOffline()` uses a fixed, hardcoded message. No dynamic data is injected into the toast.

**6. Error injection / prompt injection via file names — LOW RISK**
An adversarially named file (e.g. a token named `"; DROP TABLE tokens; --"`) would only appear in `err.message` if it caused an exception. SQLite uses parameterised queries throughout, so SQL injection is not a concern. The error text would reach the LLM as plain text within a structured MCP error response, where it is interpreted as part of the error message rather than as a tool instruction. Current risk is low, but MEDIUM-2's recommendation (stripping paths from MCP errors) would also reduce this surface.

**7. IPC error propagation sensitive data — PASS**
`server/index.ts` and `electron/main.ts` do not include API keys, database paths, or internal URLs in returned error messages. Errors return `err.message` (which may include file paths — addressed by MEDIUM-1/MEDIUM-2) but nothing more sensitive.

---

## Summary Table

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| MEDIUM-1 | Raw `err.message` forwarded into toasts, can include absolute paths | Medium | GovernanceDashboard.tsx, ExportModal.tsx |
| MEDIUM-2 | Full resolved path included in MCP chat error response to LLM | Medium | server.ts line 1764 (and related throw sites) |
| LOW-1 | `_mcpOfflineToastFired` never resets — may suppress offline warnings | Low | web-api.ts line 16 |

---

## Action Items

- [ ] Add `sanitiseToastMessage()` utility and apply to all `err.message` → toast pipelines (MEDIUM-1)
- [ ] Replace full `componentPath` with `path.basename(componentPath)` in `toolError` file-not-found messages in server.ts (MEDIUM-2)
- [ ] Reset `_mcpOfflineToastFired = false` in `ws.onopen` handler (LOW-1)
- [ ] Audit remaining `throw new Error(`...${fullPath}`)` sites in server.ts (lines 1917, 1966, 2318, 2360) — these are not wrapped in `toolError` so they surface as unstructured exceptions, but consider whether path stripping should apply there too
