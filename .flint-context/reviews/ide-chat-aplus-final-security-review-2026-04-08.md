# IDE-Chat A+ Gap Fixes — Final Security Review
**Date:** 2026-04-08
**Reviewer:** Security Review Agent
**Verdict: ADVISORY**

---

## Summary

Two of the three tracked findings are resolved. One medium finding (MEDIUM-1) is only partially fixed — the primary toast call is sanitised but three additional toast paths in the same files were missed. No new critical issues were introduced. Detailed findings below.

---

## MEDIUM-1 — Raw err.message in toasts

**Status: PARTIAL FIX**

### What was done correctly

- `src/utils/sanitiseToastMessage.ts` exists and is browser-safe (regex only, no Node.js `path` import). Logic correctly strips Unix absolute paths (`/Users/...`) and Windows absolute paths (`C:\Users\...`) and caps length at 120 characters.
- `GovernanceDashboard.tsx` line 50: `sanitiseToastMessage` is imported.
- `GovernanceDashboard.tsx` line 554: One toast call correctly wraps a static string with `sanitiseToastMessage`.
- `ExportModal.tsx` line 32: `sanitiseToastMessage` is imported.
- `ExportModal.tsx` line 145: The primary pre-flight audit error toast correctly applies `sanitiseToastMessage(err.message)`.

### Remaining gaps — unsanitised err.message reaching toasts

Three error paths still send raw `err.message` directly into `useNotificationStore.push({ message: ... })` without sanitisation:

**GovernanceDashboard.tsx line 916**
```
message: `Could not run the audit — ${msg}`,
```
`msg` is `err.message` from `handleRunAudit`. An absolute path in the MCP error would be shown verbatim in the toast.

**GovernanceDashboard.tsx line 1061**
```
message: `Fix failed — ${msg}`,
```
`msg` is `err.message` from the single-violation fix handler. Same risk.

**GovernanceDashboard.tsx line 1412**
```
message: msg,
```
`msg` is `err.message` from the a11y batch fix handler. Same risk.

**ExportModal.tsx line 300**
```
message: msg,
```
`msg` is `err.message` from `submitDeferExport`. Same risk.

### Additional surface (lower priority — inline UI, not toasts)

**ExportModal.tsx lines 261, 347**
`setFixError(...)` and `setDbomError(...)` store raw `err.message` into state variables rendered inline in the modal (`<p>{fixError}</p>`, `<span title={dbomError}>`). These are not toasts and are only visible inside an open modal to the logged-in user, but an absolute path would still be rendered in the DOM. Recommend wrapping these with `sanitiseToastMessage` (or a shared helper) for consistency.

### Required fix

Wrap all remaining `msg` / `err.message` values going into notification store `.push()` calls with `sanitiseToastMessage(msg)`. Four call sites in two files.

---

## MEDIUM-2 — Full absolute paths in MCP chat responses (server.ts)

**Status: RESOLVED**

The primary finding at `audit_ui_component` (line 1762) now uses `path.basename(componentPath)` correctly:
```
return toolError("audit_ui_component", new Error(`File not found: ${path.basename(componentPath)}`), ...)
```

All other "File not found" errors in `toolError` calls reviewed (lines 1965, 1915) also use `path.basename()`.

### Advisory — two residual cases (not user-facing toasts, lower risk)

**Lines 1312 and 1326** (resource handler, not a tool error):
```
throw new Error(`Design tokens file not found at ${tokensPath}`);
throw new Error(`Manifest file not found at ${manifestPath}`);
```
These are thrown from the MCP resource read handler and surface to MCP clients (IDE agents, CI), not to Glass UI toasts. They include full absolute paths. This is lower severity than the original finding but still leaks the server's filesystem layout to AI agents reading MCP resources. Recommend `path.basename()` here too.

**Line 3158** (`flint_migrate_tw` per-file report):
```
error: `File not found: ${filePath}`,
```
This is a field in a structured JSON result object returned to the MCP caller, not a user-facing string. The full path is intentional here (the caller needs to know which file was missing). No change needed.

**Line 1988** (`flint_ast_mutate` parse error):
```
new Error(`Failed to parse target file: ${err.message}`)
```
The Babel parser sometimes includes a file path in its `message`. This is borderline — Babel messages typically say "Unexpected token" rather than paths, but it cannot be guaranteed. Low probability, acceptable risk.

---

## LOW-1 — _mcpOfflineToastFired never resets

**Status: RESOLVED**

`src/adapters/web-api.ts` line 114:
```
ws.onopen = () => {
  _mcpOfflineToastFired = false
```
The flag is correctly reset to `false` when the WebSocket reconnects. Users will see the offline toast again if the connection drops and recovers.

---

## New Phase 2 changes — additional path leak scan

A broad scan of `src/components/ui/` for `err.message` reaching notification calls also found:

- `ComponentScopePanel.tsx` lines 449 and 568: raw `err.message` in `message:` fields of notification pushes. Not part of the current PR scope but follows the same pattern as the MEDIUM-1 residuals.
- `PolicySettings.tsx` line 606: same pattern.

These pre-date the current phase or are out of scope, but they confirm the sanitisation helper is not being consistently applied project-wide. Recommend a follow-on sweep.

---

## Action Items

| Priority | File | Line(s) | Action |
|----------|------|---------|--------|
| Required | `GovernanceDashboard.tsx` | 916, 1061, 1412 | Wrap `msg` with `sanitiseToastMessage(msg)` before passing to `message:` field |
| Required | `ExportModal.tsx` | 300 | Wrap `msg` with `sanitiseToastMessage(msg)` |
| Recommended | `ExportModal.tsx` | 261, 347 | Wrap `setFixError` / `setDbomError` values with `sanitiseToastMessage` |
| Recommended | `flint-mcp/src/server.ts` | 1312, 1326 | Use `path.basename()` in resource handler error messages |
| Follow-on | `ComponentScopePanel.tsx`, `PolicySettings.tsx` | various | Apply `sanitiseToastMessage` consistently |

---

## Verdict

**ADVISORY** — The originally reported primary toast path (ExportModal pre-flight audit) is fixed, and LOW-1 is fully resolved. MEDIUM-2 is substantively fixed. However, MEDIUM-1 is incomplete: three toast paths in GovernanceDashboard and one in ExportModal still send raw `err.message` to visible notifications without sanitisation. These are straightforward one-line fixes per call site. The advisory should be cleared before shipping.
