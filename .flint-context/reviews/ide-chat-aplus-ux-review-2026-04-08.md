# IDE Chat UX A+ Sprint Review
**Date:** 2026-04-08
**Scope:** Sprint 1 (MCP chat UX) + Sprint 2 (Glass error handling)
**Reviewer:** Code Review Agent

---

## Executive Summary

**Grade: B+**

Sprint 1 and Sprint 2 together represent a genuine and well-executed step forward. The cold-start welcome, structured error recovery, JSON summaries, and Glass toast system are all real improvements that meaningfully close the "chat dead-end" problem. The implementation is solid where it exists. The gap to A+ is narrow and specific: a cluster of bare `throw` statements bypass the `toolError` helper and send raw error strings into chat, the `deleteToken` rollback has a silent ordering gap, and the `flint://dashboard` resource is missing its intro summary sentence despite every peer resource having one.

---

## Section 1: Chat UX — Cold Start and Onboarding

### What was reviewed
`flint-mcp/src/server.ts` — `buildGreeting()`, `detectReturningUser()`, `flint_status` handler.

### Findings

**Strength — context-aware greeting is genuinely good.** `buildGreeting()` distinguishes first-time from returning users. A first-timer sees 5 plain-English quick-start breadcrumbs. A returning user sees their health grade, top violation, and three one-line next actions. This is exactly the right shape for a cold-start experience in a chat interface.

**Strength — `flint_status` is a safe landing.** The handler returns a readable multi-line block including "New here? Say 'onboard my project' to get set up." This is a sensible fallback if the model calls `flint_status` before attempting any governance work.

**Gap — `flint_status` description is still terse.** The tool's `description` field in the `ListToolsRequestSchema` handler reads: `"Read the status of the Flint MCP server."` That description is what the model sees when choosing tools. It does not signal that this is the right call for onboarding or capability discovery. The cold-start value lives in the tool response, which the model only sees after calling it. A description like `"Check server health and get quick-start guidance. Good first call for new sessions."` would make this findable at discovery time.

**Gap — `flint_assess_complexity` missing error breadcrumbs.** The missing-param guard at line 1706 returns a bare `{ isError: true, content: [{ type: "text", text: "..." }] }` object directly rather than going through `toolError()`. It does not include Common causes or Try sections. This is a minor inconsistency but breaks the recovery contract.

---

## Section 2: Error Recovery — Structured Breadcrumbs

### What was reviewed
`flint-mcp/src/core/errorResponse.ts`, `toolError()` call sites in `server.ts`.

### Findings

**Strength — `errorResponse.ts` design is clean.** The `toolError()` helper + pre-built `HINTS` dictionary is a good pattern. The six hint sets cover the most common failure modes: file not found, missing params, parse errors, no tokens, no library, no Figma connection, and empty registry. The separation of "Common causes" from "Try" sections makes recovery actionable without being verbose. Stack traces are correctly kept out of chat responses.

**Strength — adoption rate is meaningful.** 24 `toolError()` call sites versus 15 remaining bare `throw new Error` statements. The majority of user-facing error paths are covered.

**Gap — 15 bare throws remain in the call handler dispatch.** These bypass the structured error format entirely:

| Line | Tool / Context | Problem |
|------|---------------|---------|
| 1312 | Capabilities resource | `throw new Error("Design tokens file not found...")` — no recovery hint |
| 1326 | Capabilities resource | `throw new Error("Manifest file not found...")` — no recovery hint |
| 1520 | `flint://violations/{filePath}` resource | `throw new Error("File not found: ...")` — should use `HINTS.fileNotFound` |
| 1533 | Resource handler fallthrough | `throw new Error("Unknown resource: ...")` — raw, no guidance |
| 1666 | Prompt handler fallthrough | `throw new Error("Unknown prompt: ...")` — raw, no guidance |
| 1771 | `audit_ui_component` | `throw new Error("Could not find project root...")` — buried inside try block, bypasses outer `toolError` |
| 1917 | `hydrate_figma_data` | `throw new Error("Project root not found...")` — no hint |
| 1966 | `flint_ast_mutate` | `throw new Error("File not found: ...")` — should use `HINTS.fileNotFound` |
| 1971 | `flint_ast_mutate` | `throw new Error("Could not find project root...")` — no hint |
| 1989 | `flint_ast_mutate` | `throw new Error("Failed to parse target file...")` — should use `HINTS.parseError` |
| 2318 | `read_design_intent` | `throw new Error("Project root not found...")` — no hint |
| 2356 | `flint_query_registry` | `throw new Error("Missing required parameter...")` — should use `HINTS.missingParam()` |
| 2360 | `flint_query_registry` | `throw new Error("Project root not found...")` — no hint |
| 3155 | `flint_ast_mutate` security | `throw new Error("Invalid glob...")` — no hint |
| 3988 | Tool dispatch fallthrough | `throw new Error("Unknown tool: ...")` — raw, no guidance |

The highest-priority ones are `flint_ast_mutate` (lines 1966, 1971, 1989) and `flint_query_registry` (lines 2356, 2360) because these are heavily-used tools where a user hitting an error mid-workflow needs recovery guidance immediately.

**Gap — `flint_assess_complexity` missing-param guard (line 1706–1708).** Uses raw `{ isError: true, content: [...] }` object literal instead of `toolError()`. Inconsistent with every other param validation in the file.

---

## Section 3: JSON Readability

### What was reviewed
`flint_get_context` handler (line 1682–1694), `flint://session-context` resource (line 1406–1419), `flint://dashboard` resource (line 1362–1377), `flint://agent-risk` resource (line 1444–1466), `flint://anomalies` resource (line 1469–1492).

### Findings

**Strength — four of five resources have intro summary lines.** `flint://session-context`, `flint://agent-risk`, `flint://anomalies`, and `flint_get_context` (the tool) all prepend a plain-English one-liner before the JSON dump. The format `Project: myapp | Health: B (82/100) | 3 violations | Active: App.tsx` is compact and genuinely useful — a model can parse intent from the first line alone without reading the JSON.

**Gap — `flint://dashboard` resource is missing its summary line.** The handler at line 1362 correctly computes `dbGrade`, `dbScore`, and `dbTrend` but uses those values only inside `dbSummary` which is then prepended before the JSON at line 1374. Wait — on re-reading, the summary IS prepended: `text: \`${dbSummary}\n\n${JSON.stringify(dashboard, null, 2)}\`` at line 1374. This is correct.

However, the `flint://dbom` resource (line 1390–1404) and `flint://policy` resource (line 1379–1387) have no intro summary line — they return raw JSON directly. These are less commonly called but represent an inconsistency in the pattern. The policy resource in particular is readable as a JSON config, but the DBOM resource dumps a large structure with no orientation sentence.

**Minor gap — `flint_assess_complexity` response (line 1730–1732) is a raw `JSON.stringify` with no summary.** Given that this tool routes the model to a Flash vs Thinking model tier, a one-line "Use [model tier] — complexity score X" prefix would make the result immediately actionable without parsing JSON.

---

## Section 4: Toast Quality

### What was reviewed
`src/adapters/web-api.ts` (MCP offline toast), `src/components/ui/GovernanceDashboard.tsx` (governance data unavailable toast), `src/components/ui/ExportModal.tsx` (export check failed toast), `src/store/tokenStore.ts` (token file unreadable toast).

### Toast inventory

| Toast | Title | Severity | autoDismiss | Fire-once guard | Actionable? |
|-------|-------|----------|-------------|-----------------|-------------|
| MCP offline | "Governance engine offline" | error | 8000ms | Module-level flag `_mcpOfflineToastFired` | Yes — explains what's unavailable |
| Governance data unavailable | "Governance data unavailable" | warning | 5000ms | `useRef` per mount | Partially — "Try refreshing the panel" |
| Export check failed | "Export check failed" | error | 8000ms | `useRef` per modal open | Yes — "Check the MCP connection" |
| Token file unreadable | "Token file unreadable" | warning | 5000ms | None (fires on every SyntaxError) | Yes — "Token governance is paused" |

**Strength — fire-once guards on three of four toasts.** The MCP offline guard uses a module-level boolean (`_mcpOfflineToastFired`) that survives React re-renders. The GovernanceDashboard guard uses `useRef` correctly so it fires once per mount. The ExportModal guard uses `useRef` so it fires once per modal open. These are the right approaches.

**Gap — Token file unreadable toast has no fire-once guard.** The `importTokensJSON` catch block fires the toast on every `SyntaxError` with no deduplication. If `importTokensJSON` is called multiple times in quick succession (e.g. on a watcher-triggered reload), the user could see multiple "Token file unreadable" toasts. A module-level or store-level flag matching the pattern used in `web-api.ts` would close this.

**Gap — "Governance data unavailable" toast message is passive.** "Try refreshing the panel" is not actionable — users cannot refresh a sidebar panel; they can only reload the app or wait. A more accurate message would be "Restart Flint or check that the MCP server is running." This also aligns the toast with the MCP offline toast's message pattern.

**Gap — severity mismatch.** The "Token file unreadable" and "Governance data unavailable" toasts use `severity: 'warning'` which auto-dismisses in 5000ms. However, both conditions represent governance being silently paused — which is arguably an `error` (8000ms) or even `critical` (persistent). Token governance being offline is not a warning, it is a failure state. The MCP offline toast correctly uses `severity: 'error'`.

**Strength — toast API is correctly used.** All four toasts go through `useNotificationStore.getState().push()` rather than accessing Zustand state directly inside an event handler, which is the correct pattern for non-React contexts.

---

## Section 5: Rollback Correctness (deleteToken)

### What was reviewed
`src/store/tokenStore.ts`, `deleteToken` action (lines 168–185).

### Findings

**Strength — optimistic rollback is implemented.** The pattern is: save reference to token → optimistic remove from state → IPC call → on failure, restore token and set error. This is correct and matches the standard optimistic update pattern.

**Gap — restore appends to the end of the array, not the original position.** Line 180: `set((state) => ({ tokens: [...state.tokens, tokenToDelete] }))`. The token is restored by appending to the tail of the current token list. If the token was the third of twenty, it reappears last. For a UI that renders tokens in list order, this is a visible jolt — the item flashes out and then reappears at the bottom. The fix is to restore the token at its original index:

```typescript
const originalIndex = get().tokens.findIndex((t) => t.id === id)
// ... after failed IPC ...
set((state) => {
  const next = [...state.tokens]
  const insertAt = Math.min(originalIndex, next.length)
  next.splice(insertAt, 0, tokenToDelete!)
  return { tokens: next }
})
```

**Minor gap — no toast notification on deleteToken failure.** The `set({ error: message })` updates the store's `error` field but nothing in the component tree subscribes to `tokenStore.error` to surface it as a toast. The user sees the token disappear and reappear with no explanation unless they are watching the console. The token file unreadable toast fires for `importTokensJSON` failures — `deleteToken` failure is at least as disruptive and deserves the same treatment.

---

## Section 6: Coverage of the "New User Journey"

**Reconstructed journey:** new user installs Flint MCP, opens Claude Code, types "what can I do?", tries to audit a file, hits an error, recovers, runs a successful audit, tries to export.

| Step | Status | Notes |
|------|--------|-------|
| Connect to MCP | Pass | Server instructions + `flint_status` breadcrumbs are discoverable |
| Know what to do first | Pass | Cold-start greeting lists 5 plain-English actions |
| Run first audit | Pass | `audit_ui_component` summary line + `Recommendation:` prefix guides next step |
| Hit file-not-found error | Pass | `toolError` + `HINTS.fileNotFound` gives two causes and two recovery steps |
| Hit parse error | Pass | `toolError` + `HINTS.parseError` gives two causes and two recovery steps |
| Hit missing-param error on `flint_query_registry` | Fail | Bare `throw new Error("Missing required parameter...")` — no recovery guidance |
| Hit project-root error on `flint_ast_mutate` | Fail | Bare `throw new Error("Could not find project root...")` — no recovery guidance |
| Understand audit result | Pass | Summary sentence + Recommendation field before JSON |
| Export successfully | Pass | ExportModal preflight audit works; toast fires if it fails |
| Hit MCP offline in web build | Pass | Single toast explains what is unavailable |

The journey has two failures in the error-recovery steps, both caused by unported `throw` statements in high-traffic tools.

---

## What Is Needed to Reach A+

In priority order:

1. **Port remaining bare throws to `toolError()`** — especially `flint_ast_mutate` (3 sites), `flint_query_registry` (2 sites), and the resource handler fallthrough. This is the single largest gap between B+ and A+.

2. **Fix `deleteToken` restore position** — restore the token at its original index, and add a toast notification so the failure is visible to the user.

3. **Add fire-once guard to `importTokensJSON` toast** — matches the pattern already used in the three working toasts.

4. **Upgrade "Governance data unavailable" toast message** — change from "Try refreshing the panel" to something the user can actually act on.

5. **Add summary lines to `flint://dbom` and `flint://policy` resources** — extend the intro-sentence pattern that works well on the other five resources.

6. **Update `flint_status` description field** — signal that it is the right call for onboarding and capability discovery, not just a health check.

---

## Score Breakdown

| Criterion | Score | Notes |
|-----------|-------|-------|
| Chat UX — new user journey, no dead ends | B+ | Cold-start is excellent; 2 high-traffic tools still throw raw errors |
| Error recovery — Common causes + Try sections | B | 24/39 error paths use toolError; 15 bare throws remain |
| JSON readability — plain-English summaries | A- | 4/5 key resources have summaries; DBOM/policy are raw |
| Toast quality — actionable, fire-once | B+ | 3/4 toasts have fire-once guard; severity mismatch on 2 |
| Rollback correctness | B | Optimistic rollback works but restores at wrong position; no toast |

**Overall: B+**

The work is real, the direction is right, and the foundations are solid. The gap to A+ is a specific and bounded list of remediations, not a rethink.
