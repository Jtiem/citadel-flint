# IDE-Chat A+ Gap Fixes — Final Code Review
**Date:** 2026-04-08  
**Reviewer:** Senior Code Reviewer  
**Scope:** 6 targeted fixes from the B+ review cycle  
**Files examined:**
- `src/store/tokenStore.ts`
- `src/store/__tests__/tokenStore.errorHandling.test.ts`
- `src/adapters/web-api.ts`
- `src/utils/sanitiseToastMessage.ts`
- `src/utils/__tests__/sanitiseToastMessage.test.ts`
- `flint-mcp/src/server.ts`
- `src/components/ui/GovernanceDashboard.tsx`
- `src/components/ui/TokenManager.tsx`
- `src/components/ui/ExportModal.tsx`

---

## Fix 1 — deleteToken rollback position (tokenStore.ts)

**Status: CONFIRMED CORRECT**

All four sub-criteria are met:

1. `originalIndex` is captured via `findIndex` **before** the optimistic `set((state) => ({ tokens: state.tokens.filter(...) }))` call (lines 170-173). The sequence is correct.

2. On failure, the token is spliced back at `originalIndex` using `restored.splice(insertAt, 0, tokenToDelete)`. The insert position is not simply appended — it uses the captured index (lines 180-186).

3. There is an explicit fallback: `const insertAt = originalIndex >= 0 && originalIndex <= restored.length ? originalIndex : restored.length`. If `originalIndex` were somehow -1 (impossible given the guard on line 171, but defensively handled), the token falls back to the tail. Belt-and-suspenders is appropriate here.

4. The test at line 175-194 in `tokenStore.errorHandling.test.ts` asserts `tokens[0].id === 10`, `tokens[1].id === 20`, `tokens[2].id === 30` — positional assertion, not just presence. The -1 guard path is also covered by the "id not found" test at line 213.

**No issues.**

---

## Fix 2 — _mcpOfflineToastFired reset (web-api.ts)

**Status: CONFIRMED CORRECT**

`_mcpOfflineToastFired = false` appears inside `ws.onopen` at line 114, before the handler closes. The placement is correct — it resets on every successful reconnect so the next disconnection can surface a fresh toast. The `onopen` handler currently has only this one line, so ordering is not a concern.

One minor observation: `ws.onerror` fires `notifyMcpOffline()`, but `ws.onclose` does not. In practice, a clean close (server restart, network drop) may never trigger `onerror`, meaning the toast would not fire on a normal disconnect. This is a pre-existing behavior not introduced by this fix and is out of scope, but worth noting for a future pass.

**No issues introduced by this fix.**

---

## Fix 3 — Cross-store import removed (tokenStore.ts)

**Status: CONFIRMED CORRECT**

There is no `import { useNotificationStore }` or any mention of `notificationStore` anywhere in `src/store/tokenStore.ts`. The grep confirms zero matches. The store's catch blocks write only to `set({ error: message })` and `console.warn`.

The toast responsibility is correctly delegated to `TokenManager.tsx`, which uses a `useEffect` watching `error` to call `useNotificationStore.getState().push(...)` at lines 275-286. This pattern correctly keeps IPC and notification side-effects in the component layer, not the store.

**However, one bug was found in the component layer (see Bug 1 below).**

---

## Fix 4 — toolError() coverage (flint-mcp/src/server.ts)

**Status: CONFIRMED CORRECT — FULL COVERAGE**

A grep for `{ isError: true, content: [{ type: "text", text:` returns **0 matches** across the entire server.ts file. All raw inline error objects have been eliminated.

`toolError()` is imported from `./core/errorResponse.js` at line 153 and is used in 20+ call sites throughout the file, including:
- `flint_ast_mutate` — uses `toolError()` for file-not-found and parse failures (lines 1965, 1970, 1988)
- `flint_query_registry` — uses `toolError()` for missing parameter and invalid project root (lines 2355, 2359)

All error paths examined use the centralised helper. Coverage is complete.

**No issues.**

---

## Fix 5 — sanitiseToastMessage (sanitiseToastMessage.ts + callsites)

**Status: CONFIRMED CORRECT with one observation**

**Regex correctness:**

Unix path regex: `/(?:\/[^\s/]+)+\/([^\s/]+)/g`

Mental test — `/Users/justin/project/src/Button.tsx`:
The greedy `(?:\/[^\s/]+)+` consumes `/Users/justin/project/src`, then `\/([^\s/]+)` captures `Button.tsx`. Group 1 = `Button.tsx`. Replacement = `Button.tsx`. Correct.

Single-segment path `/Button.tsx`:
`(?:\/[^\s/]+)+` matches `/Button`, but there is no remaining `\/([^\s/]+)` segment. No match. The bare filename is preserved as-is. This is correct — the regex does not over-strip.

Windows path regex: `/(?:[A-Z]:\\)?(?:[^\s\\]+\\)+([^\s\\]+)/gi`

Mental test — `C:\Users\justin\project\src\Button.tsx`:
`(?:[A-Z]:\\)?` matches `C:\`, then `(?:[^\s\\]+\\)+` greedily consumes `Users\justin\project\src\`, then `([^\s\\]+)` captures `Button.tsx`. Correct.

The `path.basename` approach in `server.ts` (MCP-side, Node.js) correctly complements the regex approach in the renderer (no Node.js access). Both paths are covered.

**Import/usage verified:**
- `GovernanceDashboard.tsx` line 50: imported; applied at line 554 for the MCP-unavailable toast message.
- `ExportModal.tsx` line 32: imported; applied at line 145 for pre-flight audit error messages.
- `server.ts`: `path.basename()` used for file-not-found messages at lines 1762, 1965, 1915, 3526, 3530, and several other callsites.

**One observation:** The sanitiser in `GovernanceDashboard.tsx` line 554 is applied to a hardcoded string literal (`'Governance tools are unavailable. Check that the Flint MCP server is running.'`) that contains no paths. Calling `sanitiseToastMessage` on it is harmless but unnecessary. Not a bug.

**No issues.**

---

## Fix 6 — Governance toast severity (GovernanceDashboard.tsx)

**Status: PARTIALLY CORRECT — one bug remains**

The primary governance-unavailable toast (MCP server offline, triggered via `fetchOverrideCount` at line 550) correctly uses `severity: 'error'` and a message containing an actionable instruction ("Check that the Flint MCP server is running"). This specific toast matches the requirements.

**Bug 1 — TokenManager.tsx line 279: token error toast uses wrong severity**

The `useEffect` in `TokenManager` that fires when the token store surfaces an error (e.g., after a failed `deleteToken`) uses:

```
severity: 'warning',
```

A token deletion that silently rolls back without alerting the user with an `error`-level toast is misleading. The operation failed; the user needs to know it was an error, not a warning. This violates the intent of Fix 3 (moving toast responsibility to the component) because the component downplays the severity.

The fix is a one-character change:
- Line 279: `severity: 'warning'` → `severity: 'error'`

**Other toasts in GovernanceDashboard:** Lines 713 (anomaly data unavailable), 1008, 1018, 1037, 1062 use `severity: 'warning'` for situations that are genuinely degraded-but-not-broken (anomaly data not loading, fix not applicable, no active file). These are defensible as warnings — they represent partial unavailability rather than outright failure. The original Fix 6 question is satisfied for the primary governance toast.

---

## Summary of Findings

| Fix | Status | Notes |
|-----|--------|-------|
| Fix 1: deleteToken rollback position | CONFIRMED | `originalIndex` captured pre-remove, splice at position, -1 fallback, positional test assertions all present |
| Fix 2: _mcpOfflineToastFired reset | CONFIRMED | Reset in `ws.onopen` before handler closes |
| Fix 3: Cross-store import removed | CONFIRMED | No `notificationStore` in tokenStore.ts; toast correctly in TokenManager |
| Fix 4: toolError() coverage | CONFIRMED | Zero `isError: true` raw objects remain; flint_ast_mutate and flint_query_registry both use toolError() |
| Fix 5: sanitiseToastMessage | CONFIRMED | Regex correct for Unix and Windows paths; imported in GovernanceDashboard and ExportModal; path.basename used in server.ts |
| Fix 6: Governance toast severity | PARTIAL | GovernanceDashboard MCP-offline toast is `severity: 'error'` — correct. TokenManager token-error toast is `severity: 'warning'` — should be `'error'` |

---

## Defects Requiring Action

### Bug 1 — TokenManager.tsx severity mismatch (Minor)

**File:** `src/components/ui/TokenManager.tsx`, line 279  
**Current:** `severity: 'warning'`  
**Required:** `severity: 'error'`  
**Reason:** Token CRUD failures (delete rollback, import error, etc.) are errors, not warnings. A user who sees a yellow warning toast may not realize their delete silently failed and was rolled back.

---

## Grade

**A-**

Five of six fixes are technically correct and complete. The single remaining defect is a one-line severity string in `TokenManager.tsx` — it does not affect correctness or safety, but it misrepresents the severity of a failed destructive operation to the user. Fix it before shipping and this batch is clean.
