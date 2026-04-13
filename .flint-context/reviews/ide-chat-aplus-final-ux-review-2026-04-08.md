# IDE Chat UX — A+ Final Verification Review
**Date:** 2026-04-08
**Scope:** Verification of 6 fixes from B+ review
**Reviewer:** Code Review Agent (final pass)

---

## Grade: A

Five of six fixes are confirmed resolved. One residual gap (two resource-handler error messages leaking full absolute paths) prevents A+. The gap is small and does not affect chat UX — it is a server-side information-disclosure detail in a code path users rarely encounter.

---

## Fix-by-Fix Verdict

### Fix 1 — deleteToken rollback position
**Status: CONFIRMED RESOLVED**

`src/store/tokenStore.ts` lines 168–189 now correctly capture both the token and its original index before the optimistic remove:

```ts
const originalIndex = get().tokens.findIndex((t) => t.id === id)
const tokenToDelete = originalIndex !== -1 ? get().tokens[originalIndex] : undefined
set((state) => ({ tokens: state.tokens.filter((t) => t.id !== id) }))
```

On IPC failure, the rollback uses `splice(insertAt, 0, tokenToDelete)` where `insertAt` is the captured `originalIndex` (clamped to array length). This is correct. A token that was at index 2 restores at index 2, not appended to the tail.

No issues remaining on this fix.

---

### Fix 2 — `_mcpOfflineToastFired` reset on reconnect
**Status: CONFIRMED RESOLVED**

`src/adapters/web-api.ts` lines 113–115:

```ts
ws.onopen = () => {
  _mcpOfflineToastFired = false
}
```

The flag resets in `ws.onopen` exactly as specified. A reconnect after an offline period will allow one new toast if the connection subsequently drops again. The implementation matches the intent.

No issues remaining on this fix.

---

### Fix 3 — Cross-store import removed from tokenStore
**Status: CONFIRMED RESOLVED**

`src/store/tokenStore.ts` has no import of `useNotificationStore` or any reference to `notificationStore`. The store is clean.

`src/components/ui/TokenManager.tsx` lines 21–26 import `useNotificationStore` directly (as a component-level import, which is the correct pattern). Lines 273–286 show the `useEffect` watching `error`:

```ts
const prevErrorRef = useRef<string | null>(null)
useEffect(() => {
  if (error && error !== prevErrorRef.current) {
    useNotificationStore.getState().push({
      type: 'error',
      severity: 'warning',
      title: 'Token operation failed',
      message: error,
      autoDismissMs: 5000,
    })
  }
  prevErrorRef.current = error
}, [error])
```

The cross-store contamination is eliminated. The `prevErrorRef` guard prevents repeat toasts for the same error string.

One minor observation (does not affect grade): the toast fires with `severity: 'warning'` for a token operation failure. A failed `deleteToken` IPC call is arguably an `error` severity event — the user's action silently failed and the UI rolled back. However, because the visible error message also appears inline in the panel (line 492–495 of TokenManager), the `warning` severity is defensible as "the UI is still usable." This is a judgment call, not a violation.

No blocking issues remaining on this fix.

---

### Fix 4 — 15 bare throws ported to toolError()
**Status: CONFIRMED RESOLVED (tool handlers)**

A grep for raw `isError: true` in `flint-mcp/src/server.ts` returns zero matches. All tool handler error paths now route through `toolError()`.

The 6 remaining bare `throw new Error` calls in the file are all in:
- `ReadResourceRequestSchema` handler (lines 1312, 1326, 1520, 1533) — resource handlers, not tool handlers
- `ListPromptsRequestSchema` handler (line 1666)
- The final unknown-tool fallthrough (line 3895)

These are the correct MCP SDK pattern for resource/prompt/unknown-tool responses and do not affect the chat UX for tool invocations.

The specific tools called out for spot-check:
- `flint_ast_mutate` — all error paths return `toolError(...)` with appropriate HINTS
- `flint_query_registry` — all error paths return `toolError(...)` with appropriate HINTS

No blocking issues remaining on this fix.

---

### Fix 5 — Path sanitisation
**Status: MOSTLY RESOLVED — one residual gap**

**Confirmed:**
- `src/utils/sanitiseToastMessage.ts` exists and is correctly implemented (regex strips Unix and Windows absolute paths, caps at 120 chars)
- `src/components/ui/GovernanceDashboard.tsx` line 50 imports `sanitiseToastMessage`; line 554 applies it
- `src/components/ui/ExportModal.tsx` line 32 imports `sanitiseToastMessage`; line 145 applies it
- All `toolError()` call sites in tool handlers use `path.basename()` for file references (verified in grep output)

**Residual gap:**
Two error messages in the `ReadResourceRequestSchema` handler leak full absolute paths:

- Line 1312: `throw new Error(\`Design tokens file not found at ${tokensPath}\`)`
  Where `tokensPath = path.join(projectRoot, configPath("design-tokens.json"))` — full path exposed
- Line 1326: `throw new Error(\`Manifest file not found at ${manifestPath}\`)`
  Where `manifestPath = path.join(projectRoot, BRAND.manifestFile)` — full path exposed

These are resource handlers, not toast messages, so `sanitiseToastMessage` does not apply. The paths appear in MCP resource error responses visible in the host IDE. On a shared workspace or cloud deployment, this would expose the server's directory structure and username. The fix is simple: `path.basename(tokensPath)` and `path.basename(manifestPath)`.

This gap is minor from a UX standpoint (resource errors are rare in normal operation) but is a real information-disclosure issue from a security standpoint. It is the only thing preventing A+.

---

### Fix 6 — Governance data unavailable toast
**Status: CONFIRMED RESOLVED**

`src/components/ui/GovernanceDashboard.tsx` lines 540–558:

```ts
const governanceLoadErrorToasted = useRef(false)
// ...
if (!governanceLoadErrorToasted.current) {
  governanceLoadErrorToasted.current = true
  useNotificationStore.getState().push({
    type: 'error',
    severity: 'error',
    title: 'Governance data unavailable',
    message: sanitiseToastMessage('Governance tools are unavailable. Check that the Flint MCP server is running.'),
    autoDismissMs: 8000,
  })
}
```

All three requirements met:
- Severity is `'error'` (not `'warning'`)
- Message is actionable: "Check that the Flint MCP server is running"
- `sanitiseToastMessage` is applied
- The `governanceLoadErrorToasted` ref prevents repeat toasts

No issues remaining on this fix.

---

## Spec Success Criteria Assessment

| Criterion | Status |
|-----------|--------|
| New user can connect, audit, hit an error, and recover without leaving chat | Met — `flint_status` cold-start, `toolError()` recovery breadcrumbs, actionable error messages |
| Error messages include "Common causes" + "Try" sections | Met — `errorResponse.ts` HINTS system, fully adopted in tool handlers |
| JSON-heavy responses have plain-English summaries | Met — `buildGreeting()` and `flint_status` return narrative blocks |
| Toasts fire at the right time, only once per event, with correct severity | Met — `_mcpOfflineToastFired` flag, `governanceLoadErrorToasted` ref, `prevErrorRef` guard in TokenManager |
| deleteToken rollback restores at the original position | Met — `originalIndex` captured pre-optimistic-remove, `splice` restores at exact position |

---

## Remaining Gap (Does Not Block Ship)

**Resource handler path leakage** (`server.ts` lines 1312, 1326)

Two `throw new Error` calls in `ReadResourceRequestSchema` include full absolute paths in the error message. These are not in the toast system or chat UX flow — they surface only when a resource handler fails, which requires the MCP client to read `flint://tokens` or `flint://manifest` when those files do not exist. The fix is a one-line change in each:

```ts
// Line 1312 — change to:
throw new Error(`Design tokens file not found: ${path.basename(tokensPath)}`);

// Line 1326 — change to:
throw new Error(`Manifest file not found: ${path.basename(manifestPath)}`);
```

This is the only delta between the current state and A+.

---

## Summary

**Grade: A**

Fixes 1, 2, 3, 4, and 6 are fully and correctly implemented. Fix 5 is 95% correct — path sanitisation is applied everywhere in the toast and tool-error paths, with two residual bare-path leaks in resource handlers that the fix spec targeted but were not fully addressed. The spec success criteria are all met. The product is in good shape to ship; the resource handler fix is a low-risk one-liner that can land as a follow-up.
