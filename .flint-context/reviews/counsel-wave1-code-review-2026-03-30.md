# Counsel Wave 1 — Code Review
**Date:** 2026-03-30
**Reviewer:** Senior Code Review Agent
**Verdict:** FIX (2 issues before commit)

---

## Scope

Changes reviewed:

- `src/components/ui/GovernanceDashboard.tsx` — hook wiring refactor (Group A)
- `src/hooks/useGovernanceHealth.ts` — new canonical hook
- `src/components/ui/__tests__/GovernanceDashboard.counsel.test.tsx` — 9 new tests (Group A)
- `electron/main.ts` — `governance:preview-fix` IPC handler (Group B)
- `electron/preload.ts` — `previewFix` contextBridge addition (Group B)
- `server/index.ts` — web-parity handler (Group B)
- `src/types/flint-api.d.ts` — type declaration for `previewFix`
- `electron/__tests__/wave3-ipc.test.ts` — 20 IPC handler tests

---

## Critical Issues

### ISSUE 1 — Security: No path confinement on `governance:preview-fix` filePath (HIGH)

**Files:** `electron/main.ts` line 2718, `server/index.ts` line 1223

**Finding:** The `governance:preview-fix` handler accepts an arbitrary `filePath` string from the renderer and passes it directly to the MCP `flint_fix` tool with no confinement check.

Every other file-accepting handler in `main.ts` that touches the filesystem enforces a home-directory guard before proceeding. The pattern is consistent across the codebase:

```
// file:read handler (line 506):
if (!filePath.startsWith(home + path.sep)) {
    throw new Error('file:read — path outside user home directory is not permitted')
}

// ast:save-file handler (line 933):
if (!filePath.startsWith(home + path.sep)) {
    throw new Error('ast:save-file — path outside user home directory is not permitted')
}
```

The `governance:preview-fix` handler at line 2718 does none of this. It checks only that `filePath` is a string, then forwards it to `mcpClient.callTool('flint_fix', { file: filePath, dry_run: true })`.

**Severity:** High for production. The handler is read-only today (`dry_run: true`), which reduces immediate impact — no file is written. However:

1. The renderer calling this is sandboxed but the sandbox trust model relies on preload controls, not handler validation. A compromised renderer or a future copy-paste of this pattern to a non-dry-run handler would have no guard.
2. Consistency with every other file-accepting handler in this codebase demands the guard.
3. The `server/index.ts` web handler (line 1223) has the same gap and is more exposed — it accepts HTTP requests, not just IPC.

**Required fix:** Add the same `home + path.sep` guard used by `file:read` and `ast:save-file`. In the web handler, restrict to `activeProjectRoot` instead (no `app.getPath` available there).

**The wave3-ipc.test.ts unit tests do not cover this path** — they test pure logic reproduced outside main.ts and do not inject a path-traversal payload. No test currently would catch removal of a guard even if one were added.

---

### ISSUE 2 — Bug: `setInlineDiffData` stores `null` when `previewFix` returns null (MEDIUM)

**File:** `src/components/ui/GovernanceDashboard.tsx` line 815–816

The `toggleInlineDiff` callback does:

```typescript
const data = await window.flintAPI.governance.previewFix(ruleId, filePath)
setInlineDiffData((prev) => new Map([...prev, [key, data]]))
```

`previewFix` returns `Promise<{ current, proposed, tokenName, isColor } | null>`. When the MCP server has no fix for that rule (empty fixes array), or when the file is not parseable, it returns `null`. The code stores `null` into `inlineDiffData` under the key.

The type declaration for `inlineDiffData` is `Map<string, InlineFixPreview>` (line 800), where `InlineFixPreview` does not include `null`. This is a type mismatch that TypeScript will catch only if the types are correctly threaded through — and the `previewFix` optional chain `(... | null)` return is declared in `flint-api.d.ts` line 1986 but the map value type does not accept `null`.

The downstream render code that reads from `inlineDiffData` will receive `null` and attempt to render `null.current`, `null.proposed`, etc. The component does not guard against a null map value before rendering the diff UI. The `inlineDiffOpen` state will show the diff panel as open while `inlineDiffData.get(key)` is `null`, creating either a crash or a blank panel depending on how the render code is written.

**Required fix:** Either filter out the null before storing (`if (data) setInlineDiffData(...)`) or widen the map type to `Map<string, InlineFixPreview | null>` and guard in the render path. The simpler and more correct approach is to not store null at all: only set the key if data is non-null.

---

## Suggestions (Non-blocking)

### SUGGESTION 1 — Comment typo in main.ts (cosmetic)

**File:** `electron/main.ts` lines 2701 and 2708

Three comment lines use a single `/` instead of `//`:

```
// line 2701: / COUNSEL.1.4: Calls flint_fix...
// line 2708: / Payload: (ruleId: string, filePath: string)
// line 2709: / Return:  { current, proposed, tokenName, isColor } | null on any error
```

Same pattern appears in `server/index.ts` at lines 1214–1215. These are copy-paste artifacts and do not affect behavior, but they are inconsistent with the codebase comment style.

### SUGGESTION 2 — Malformed comment in preload.ts (cosmetic)

**File:** `electron/preload.ts` line 848

The line reads:

```
/ ── Phase ACX.5: Context Sync Pipeline ────────────────────────────...
```

Single `/` instead of `//`. Again cosmetic, but this pattern appears in a few places and could confuse syntax highlighters or future grep searches.

### SUGGESTION 3 — Test coverage gap: no path-traversal test for preview-fix

**File:** `electron/__tests__/wave3-ipc.test.ts`

The test suite (W3-01 through W3-09) correctly covers null ruleId, null filePath, disconnected MCP, empty fixes, and all field mapping variants. It does not test what happens when filePath is a path-traversal string like `../../etc/passwd`. Once Issue 1 is fixed, a test asserting that out-of-project paths return null would protect against regression.

### SUGGESTION 4 — Health score formula: a11y violations hardcoded as 'critical'

**File:** `src/components/ui/GovernanceDashboard.tsx` line 476

The `allA11yWarnings` memo maps every a11y violation to `severity: 'critical'`, giving each one a 10-point penalty. This is intentional (a11y failures are treated as critical), but this business rule exists only in this one `useMemo` — it is not in the `useGovernanceHealth` hook's `bucketViolations` logic, which is severity-agnostic. If the design ever needs to distinguish a11y severity tiers (e.g. WCAG AA vs AAA), the coupling between this hardcoded `'critical'` and the formula will be non-obvious to future contributors. A clarifying comment at the memo would help.

---

## Positive Findings

**Hook wiring is correct.** `useGovernanceHealth` receives `[...effectiveLinterWarnings, ...effectiveA11yWarnings]` which is the right combined set after delta filtering. The `severity` fields on those warnings match exactly what `bucketViolations` expects (`'critical' | 'amber' | 'advisory'`). The a11y warnings are all injected with `severity: 'critical'`, so they land in the criticals bucket as intended.

**Type contract is correct.** `flint-api.d.ts` declares `previewFix` as optional (`previewFix?`) which correctly models environments where the IPC handler may not be present. The component guards with `if (window.flintAPI.governance.previewFix && filePath)` before calling it. The return type shape `{ current, proposed, tokenName, isColor }` matches the handler in `main.ts` and the `server/index.ts` mirror exactly.

**Web parity is present.** `server/index.ts` has a matching handler for `governance:preview-fix` with identical logic to the Electron handler. Both normalize the dual-field format (`currentValue ?? current`, `proposedValue ?? proposed`, `tokenName ?? token_name`). Error handling is symmetric — both catch and return null.

**Test coverage for the IPC handler logic is thorough.** The wave3-ipc.test.ts suite uses the pure-function injection pattern (no Electron bindings required), covers 9 cases for preview-fix including all field alias combinations, and tests the boolean `isColor` derivation from both the explicit flag and the `type === 'color'` fallback.

**Commandment compliance.** No `fs` calls exist in `src/`. The previewFix IPC path does not use `FileTransactionManager` because it is read-only (`dry_run: true`) — this is correct and does not violate Commandment 14. No cross-store imports were introduced. The GovernanceDashboard still reads only from `editorStore`, `canvasStore`, `governanceStore`, and `tokenStore` — no new store dependencies.

**The formula consolidation is correct and necessary.** Removing the local `computeHealthScore` and `gradeFromScore` from GovernanceDashboard and replacing them with `useGovernanceHealth` and `gradeFromScore` from the shared hook closes the dual-formula defect tracked in `project_counsel_governance_redesign.md`. Glass and MCP now share one canonical formula.

---

## Summary

| # | Severity | Area | Status |
|---|----------|------|--------|
| 1 | High | IPC security: no path confinement on filePath | Must fix before commit |
| 2 | Medium | Bug: null stored in typed Map | Must fix before commit |
| 3 | Low | Comment typos (single `/`) | Optional |
| 4 | Low | Missing path-traversal test | Recommended after fix |

**Verdict: FIX**

Two issues require resolution before this can be committed. Issue 1 (path confinement) is the higher priority — it establishes the security invariant that every other file-path-accepting handler in the codebase already maintains, and the web build handler has the same gap. Issue 2 is a straightforward null-guard that prevents a runtime crash in the diff UI when the MCP server returns no fixes.

Both fixes are small and localized. After they are in place, re-run:
- `npm run test:react` — confirm GovernanceDashboard tests still pass
- `cd flint-mcp && npm test` — no new regressions
- `npx tsc --noEmit` — 0 errors (the null map type mismatch may surface here)
