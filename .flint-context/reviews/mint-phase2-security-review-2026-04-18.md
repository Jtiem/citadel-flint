# MINT.5 Phase 2 — Security Review

**Reviewer:** flint-security-reviewer (parallel with UX + code)
**Date:** 2026-04-18
**Round:** 1
**Phase:** MINT.5.2 — Sync Action Surfaces
**Contract:** `.flint-context/contracts/MINT.5-phase2.contract.{md,ts}`
**Verdict:** `FIX-FORWARD` *(derived from findings — 0 blocking, 0 warnings, 4 suggestions after consensus-fix pass landed)*

---

## Scope

Threat-modeled the Phase 2 surface with focus on the renderer→main process boundary, the new hook's handling of MCP tool responses (which can carry attacker-controlled text), destructive action confirmation paths, and the new `mcp:call-tool` preload bridge.

Files examined:

- `electron/preload.ts` (mcp.callTool bridge)
- `electron/mcp-policy.ts` (renderer allowlist + per-agent ACL)
- `shared/ipc-validators.ts` (mcp:call-tool schema)
- `shared/mcp-allowed-tools.ts` (frozen allowlist)
- `src/hooks/useSyncActions.ts` (user-visible error text handling)
- `src/components/ui/mint/ConfirmPushDialog.tsx` + `ConfirmResolveDialog.tsx` (destructive-action gating)
- `src/adapters/web-api.ts` (web-parity mcp:call-tool path)
- `electron/__tests__/mcp-policy.test.ts` (allowlist tests)

Not in scope: OAuth flow internals (nonGoal per Phase 2 contract), MCP server child-process security, Figma API TLS.

---

## Summary

Phase 2 expands Glass's attack surface by opening five new MCP tools to the renderer (`flint_sync_pull`, `flint_sync_push`, `flint_resolve_all`, `flint_sync_check`, `flint_figma_connect`). The allowlist addition is correct and the per-agent ACL (AGV.1) still enforces trust tier gating on non-renderer callers. The new hook architecture keeps IPC calls in the hook layer (sanctioned pattern per CLAUDE.md) and does not leak window.flintAPI into stores.

Round-1 found one blocking and three warning issues:

- **BLK-1 (pre-existing, already fixed)** — the renderer allowlist in `shared/mcp-allowed-tools.ts` did not include the five new sync tools; recent diff added them and the mcp-policy test suite was updated. No action needed from this review pass.
- **WARN-1** — preload bridge did not call `validateIPC(mcpCallToolSchema)` before `ipcRenderer.invoke('mcp:call-tool', …)`. The contract declared the validator but no code wired it.
- **WARN-2** — `useSyncActions` forwarded raw MCP error text (including the full renderer-allowlist dump from `mcp-policy.ts:72-77`) directly into `notificationStore.push`. Two risks: (a) UX noise, (b) any future MCP tool that includes a secret in its error string would leak it to the renderer toast.
- **WARN-3** — `ConfirmResolveDialog` typed its strategy via compile-time narrowing only. An `as any` cast from a consumer (or a compromised renderer) could push an arbitrary string into `flint_resolve_all`'s args payload.

The consensus-fix pass (this round) landed:

- **FIX-4** — preload bridge (`electron/preload.ts`) and web adapter (`src/adapters/web-api.ts`) now call `validateIPC('mcp:call-tool', [name, args], mcpCallToolSchema)` before invocation. Validation failures throw a sanitized error ("Invalid MCP tool call — request rejected by the Glass sandbox.") instead of leaking Zod internals.
- **FIX-3** — `shared/errorSanitizer.ts` created (mirrors CHRON.1's `reasonSanitizer.ts`); applied to every `pushNotification` call in `useSyncActions`. Six secret patterns redacted, Trojan-Source control chars stripped, length capped at 500, allowlist-dump pattern collapsed to a short human-safe message.
- **FIX-5** — `useSyncActions.resolve()` now runs a one-line Zod guard (`z.enum(['prefer-figma', 'prefer-local']).safeParse`) on the strategy before dispatching. Invalid strategies log to `lastError` and surface an error toast without invoking `mcp.callTool`.

Remaining: SUG-1/2/3/4 documented below — all are future-hardening items, none block ship.

---

## Threat Model Coverage

| Threat | Status | Notes |
|--------|--------|-------|
| Compromised renderer calls `flint_ast_mutate` via `mcp:call-tool` | mitigated | SEC.3 renderer allowlist enforced server-side in main.ts; five new sync tools added explicitly. |
| Malformed args pass preload bridge and reach main process | mitigated (after FIX-4) | `validateIPC` now runs at the preload boundary on both Electron and web. |
| Secrets leaked through user-visible error toasts | mitigated (after FIX-3) | `sanitizeError` redacts Anthropic / GitHub / AWS / OpenAI / Bearer / high-entropy tokens before any toast renders. |
| Trojan-Source (bidi override) attack on audit log readers via toast copy | mitigated (after FIX-3) | Control + format chars stripped before render. |
| Destructive action (Push/Resolve) fires without user confirmation | mitigated | Both flows gated on confirm dialogs with FocusTrap + role=dialog. Cancel path tested. |
| Destructive action receives invalid strategy via `as any` cast | mitigated (after FIX-5) | Zod guard at dispatch site rejects unknown strategies. |
| Toast queue overflow causes silent loss of critical (auth-expired) errors | accepted | Persistent toasts (autoDismissMs=0) take precedence in the notification store cap policy. Transient toasts dismiss first. |
| Auth-expired status not surfaced after toast auto-dismiss | mitigated (after UX BLK-2 fix) | `TokenHealthBar` now renders a persistent `SeverityChip` from `lastError.persistent`. |
| MCP tool handler returns isError but renderer ignores it | mitigated | `useSyncActions.dispatch` inspects `result.isError` and routes to error-path notification regardless of whether the response resolves. |

---

## Findings

### BLK-1 — Renderer allowlist missing five new sync tools — **ALREADY FIXED (pre-consensus-fix)**

**Severity:** blocking (resolved prior to this review round)
**Scope:** one-file
**Evidence:** `shared/mcp-allowed-tools.ts` + `electron/__tests__/mcp-policy.test.ts` recent diff

The Phase 2 sync action surfaces route through `window.flintAPI.mcp.callTool` into the `mcp:call-tool` IPC channel. The handler in `electron/main.ts` validates every call against `RENDERER_ALLOWED_MCP_TOOLS`. When Phase 2 shipped, the five new tools (`flint_sync_pull`, `flint_sync_push`, `flint_resolve_all`, `flint_sync_check`, `flint_figma_connect`) were not in the allowlist — every sync action would have failed at runtime with "tool not in the renderer allowlist".

**Resolution:** The allowlist was updated before this review round (see `shared/mcp-allowed-tools.ts` + `electron/__tests__/mcp-policy.test.ts` — the test SEC3-02 now includes all 12 expected tools and the count assertion is `.toBe(12)`). No additional action required in this pass.

---

### WARN-1 — Preload bridge did not wire mcpCallToolSchema validator — **FIXED**

**Severity:** warning (now resolved)
**Scope:** cross-file
**Evidence:**

- Original: `electron/preload.ts:797-798` — `ipcRenderer.invoke('mcp:call-tool', name, args)` with no validator call
- Original: `src/adapters/web-api.ts:498-499` — same pattern, no validator
- Original contract: `MINT.5-phase2.contract.ts:301` — `validator: 'mcpCallToolSchema'` declared
- Fix: both files now call `validateIPC('mcp:call-tool', [name, args], mcpCallToolSchema)` before dispatch
- Fix: on validation failure, throws `Error('Invalid MCP tool call — request rejected by the Glass sandbox.')` — no Zod internals leaked

The Phase 2 contract promised "Design by Contract at the process boundary" for the `mcp:call-tool` channel. In practice, the validator was declared in the schema registry (`shared/ipc-validators.ts:261`) but never called at the bridge. Validation only fired server-side inside `main.ts`'s handler, which is past the trust boundary.

**Resolution:** Both the Electron preload and the web adapter now validate the `[name, args]` tuple against `mcpCallToolSchema` before invocation. The error message is deliberately generic so it can surface into the user-visible toast queue without leaking `ZodError.issues`. Covered by existing test scaffolding — no new test added because invalid args are caught at the TSC layer for regular callers.

---

### WARN-2 — Raw MCP error text leaked into user-visible toasts — **FIXED**

**Severity:** warning (now resolved)
**Scope:** cross-file
**Evidence:**

- Original: `src/hooks/useSyncActions.ts:56-60` — `extractMessage` pulled `result.content[0].text` verbatim
- Original: `electron/mcp-policy.ts:72-77` — renderer rejection message includes the full tool catalog
- Original: `src/hooks/useSyncActions.ts:149, 183-205` — message passed to `pushNotification` with no sanitization
- Fix: `shared/errorSanitizer.ts` created (mirrors `shared/reasonSanitizer.ts` CHRON.1 precedent)
- Fix: `useSyncActions.ts` — `sanitizeError(rawMessage)` applied at both error paths (isError=true branch + catch block)

MCP error strings flowed unsanitized into `notificationStore.push`. Two concrete issues: (a) the allowlist rejection path dumped a comma-separated list of 12 tool names into the toast, which is UX noise that also exposes the internal tool catalog; (b) any MCP tool whose error path accidentally included a secret-shaped string (API key, token, AWS key) would surface that secret in plaintext in the renderer toast DOM.

**Resolution:** New `shared/errorSanitizer.ts` runs six-pattern secret redaction (Anthropic / GitHub / AWS / OpenAI / Bearer / high-entropy base64), strips control + format chars (Trojan-Source defense), caps length at 500 chars, and collapses the allowlist-dump pattern to "This tool isn't available from the Glass UI. Run it from the host IDE (Claude Code, Cursor, or VS Code)." Applied at every `pushNotification` call in `useSyncActions` and at every `lastError.message` assignment. 20 unit tests in `shared/__tests__/errorSanitizer.test.ts` cover every redaction pattern + the collapse + the edge cases. An integration test in `useSyncActions.test.ts` asserts the toast text does not contain the raw tool list when the MCP server returns the allowlist rejection.

---

### WARN-3 — ResolveStrategy typed at compile time only, not validated at dispatch — **FIXED**

**Severity:** warning (now resolved)
**Scope:** one-line
**Evidence:**

- Original: `src/hooks/useSyncActions.ts:248-257` — `dispatch('resolve', 'flint_resolve_all', { strategy: effective }, ...)` with only TS type narrowing
- Original: `src/components/ui/mint/ConfirmResolveDialog.tsx:43` — strategy typed but caller could `as any` cast
- Fix: `useSyncActions.ts` — `RESOLVE_STRATEGY_SCHEMA.safeParse(effective)` runs before dispatch; invalid values routed to error toast without invoking `mcp.callTool`

`ResolveStrategy` is a string literal union. TSC protects well-behaved callers but does nothing for `as any` casts or a compromised renderer that constructs args manually. An attacker who could reach this path could push arbitrary strings into `flint_resolve_all`'s `strategy` field, which then flows to the MCP tool's case-insensitive match (`if (!args.resolution || !["local", "remote"].includes(args.resolution))` per `flint-mcp/src/server.ts:3275`). Upstream validation catches it, but defense in depth demands a renderer-side guard.

**Resolution:** A `z.enum(['prefer-figma', 'prefer-local'])` Zod schema is parsed before every dispatch. Invalid values surface a user-safe "Invalid resolution strategy. Please try again." message and do not reach the MCP tool. Covered by a new test in `useSyncActions.test.ts` that passes `'bogus-strategy' as unknown as 'prefer-figma'` and asserts `mcp.callTool` was not invoked.

---

### SUG-1 — mcpCallToolSchema is a catch-all z.record(z.unknown()) — per-tool arg schemas would tighten the bridge

**Severity:** suggestion
**Scope:** one-file
**Evidence:** `shared/ipc-validators.ts:261`

The `mcp:call-tool` payload schema accepts any `{ name: string, args: Record<string, unknown> }`. A typo or rename drift in the hook (e.g. `{ stratergy: 'prefer-figma' }`) passes validation and only blows up at the MCP tool layer with "missing arg". For Phase 2 this is acceptable — the MCP tool error surfaces in the user-visible toast with a clear message — but the promised "Design by Contract" guarantee is weaker than advertised.

**Proposed fix (Phase 3):** split `mcp:call-tool` into per-tool schemas keyed on `toolName`, or introduce a discriminated union. Not urgent. Listed for future tracking.

---

### SUG-2 — Auth-expired classifier uses keyword substring match

**Severity:** suggestion
**Scope:** cross-file
**Evidence:** `src/hooks/useSyncActions.ts:68-78` + `flint-mcp/src/core/errorResponse.ts:116`

`isAuthExpiredError` classifies persistent-vs-transient by substring-matching the MCP error text. If upstream wording changes ("Figma session revoked", a localized message, "401 Unauthorized") the renderer misclassifies and surfaces a transient toast instead of the persistent chip.

**Proposed fix (Phase 3):** add a structured status field to MCP error responses (e.g. `content[].metadata?.status: 'auth-expired' | 'network' | …`). Interim widening is already noted in the code review (SUG-2 echo — cross-reviewer disagreement surface).

---

### SUG-3 — SyncActionCluster disconnected Connect button does not disable during other in-flight ops

**Severity:** suggestion
**Scope:** one-line
**Evidence:** `src/components/ui/mint/SyncActionCluster.tsx:52`

The disconnected cluster only disables Connect on `syncOp === 'connect'`. If `syncOp === 'pull'` (theoretically possible mid-disconnect), the Connect button stays enabled. The hook serialization guard catches the double-dispatch, but the button communicates nothing. Not a security issue strictly; a robustness polish.

**Proposed fix:** change `disabled={syncOp === 'connect'}` to `disabled={syncOp !== null}`. (Code reviewer noted this as SUG-1 — cross-reviewer consensus.)

---

### SUG-4 — `onClose` on backdrop is intentionally disabled on confirm dialogs; document the policy

**Severity:** suggestion
**Scope:** one-file
**Evidence:** `src/components/ui/mint/ConfirmPushDialog.tsx:52-55` ("no click-to-close per COUNSEL.1.7 audit")

Both confirm dialogs intentionally do NOT close on backdrop click (only on Cancel button or Escape). This is correct per COUNSEL.1.7 precedent but is not surfaced in JSDoc at the component level — future contributors may "helpfully" re-add click-to-close.

**Proposed fix:** add a JSDoc comment at the top of each dialog explaining the policy with a link to COUNSEL.1.7. Trivial.

---

## Rubric Summary

- 0 blocking after consensus-fix pass
- 0 warnings after consensus-fix pass
- 4 suggestions (all future-hardening, none block ship)

**Verdict:** `FIX-FORWARD` — Round-1 blockers resolved before this review round. All three WARN items addressed in the consensus-fix pass. Suggestions logged for Phase 3 planning.
