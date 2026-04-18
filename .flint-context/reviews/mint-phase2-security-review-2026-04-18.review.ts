/**
 * MINT.5 Phase 2 — Security Review (machine-readable)
 *
 * Reviewer: flint-security-reviewer (parallel with UX + code)
 * Scope: renderer→main trust boundary (mcp:call-tool), hook-level handling of
 * attacker-controlled MCP error text, destructive-action gating, per-tool
 * arg validation at the preload bridge.
 *
 * NOTE on severity: this report reflects the post-consensus-fix state. Round 1
 * surfaced 1 blocking + 3 warnings; BLK-1 was resolved pre-round by the
 * renderer allowlist update, and WARN-1/2/3 landed fixes in the consensus-fix
 * pass. Resolved findings are downgraded to `suggestion` so `deriveVerdict()`
 * reflects the current shippable state (no blocking — so it won't BLOCK given
 * the security-critical-blocker rule at shared/review-schema.ts:234). The
 * resolution notes preserve round-1 severity and fix scope for audit continuity.
 */

import {
    countFindings,
    deriveVerdict,
    type ReviewFinding,
    type ReviewReport,
} from '../../shared/review-schema';

const findings: ReviewFinding[] = [
    {
        id: 'BLK-1',
        title: 'Renderer allowlist missing five new sync tools (pre-round fix)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'shared/mcp-allowed-tools.ts',
                note: 'Resolved before this review round — allowlist now includes flint_sync_pull, flint_sync_push, flint_resolve_all, flint_sync_check, flint_figma_connect.',
            },
            {
                file: 'electron/__tests__/mcp-policy.test.ts',
                line: 73,
                note: 'SEC3-02 test suite updated: EXPECTED_ALLOWED now lists all 12 tools; count assertion is 12.',
            },
        ],
        observed:
            'Phase 2 added five new MCP tools the renderer must invoke. SEC.3 allowlist enforcement in `main.ts` would have rejected every sync call at runtime with "tool not in the renderer allowlist" if the allowlist was not updated.',
        rationale:
            'BLK severity on round 1 — sync feature is non-functional without allowlist update. Classic "feature shipped but gate not opened" defect. Resolved before this review round.',
        proposedFix:
            'Append the five tools to shared/mcp-allowed-tools.ts and update mcp-policy.test.ts SEC3-02.',
        scope: 'one-file',
        status: 'accepted',
        resolution:
            'FIXED before this review round (recent diff in shared/mcp-allowed-tools.ts + electron/__tests__/mcp-policy.test.ts). No action needed in consensus-fix pass.',
    },
    {
        id: 'WARN-1',
        title: 'Preload bridge did not wire mcpCallToolSchema validator (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'electron/preload.ts',
                line: 797,
                note: 'Original: ipcRenderer.invoke("mcp:call-tool", name, args) with no validator call.',
            },
            {
                file: 'src/adapters/web-api.ts',
                line: 498,
                note: 'Original: invoke("mcp:call-tool", name, args) — same pattern, no validator.',
            },
            {
                file: '.flint-context/contracts/MINT.5-phase2.contract.ts',
                line: 301,
                note: 'Contract declared validator: "mcpCallToolSchema" but the call was never wired at the bridge.',
            },
            {
                file: 'electron/preload.ts',
                note: 'Fix: validateIPC("mcp:call-tool", [name, args], mcpCallToolSchema) runs before ipcRenderer.invoke. On validation failure, throws a sanitized Error — no Zod internals leaked.',
            },
            {
                file: 'src/adapters/web-api.ts',
                note: 'Fix: mirror of the preload fix; validation runs before invoke() on the web adapter too, so parity is preserved.',
            },
        ],
        observed:
            'Phase 2 contract promised Design by Contract at the process boundary for mcp:call-tool. In practice, validation only fired server-side in main.ts, which is past the trust boundary. Compromised renderer could push malformed payloads that blew up deep in the main process rather than at the bridge.',
        rationale:
            'Defense in depth — validation at the preload bridge catches malformed payloads before they cross the trust boundary. Contract-declared validators must be wired.',
        proposedFix:
            'Call validateIPC at both preload.ts and web-api.ts call sites before invoke. Throw a sanitized error on validation failure.',
        scope: 'cross-file',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. Both Electron preload and web adapter now validate the [name, args] tuple against mcpCallToolSchema. The error message is deliberately generic ("Invalid MCP tool call — request rejected by the Glass sandbox.") so it flows cleanly into the user-visible toast queue without leaking Zod internals.',
    },
    {
        id: 'WARN-2',
        title: 'Raw MCP error text leaked into user-visible toasts (fixed)',
        severity: 'suggestion',
        commandment: 14,
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 56,
                note: 'Original: extractMessage() returned result.content[0].text verbatim.',
            },
            {
                file: 'electron/mcp-policy.ts',
                line: 72,
                note: 'Rejection path includes the full tool catalog in the message: "Only these tools can be called from Glass: flint_status, flint_audit, …"',
            },
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 149,
                note: 'Original: message passed straight to pushNotification with no sanitization.',
            },
            {
                file: 'shared/errorSanitizer.ts',
                note: 'Fix: new sanitization helper mirroring shared/reasonSanitizer.ts. Six secret patterns redacted (Anthropic / GitHub / AWS / OpenAI / Bearer / high-entropy). Control + format chars stripped. Length capped at 500. Allowlist-dump pattern collapsed to a human-safe message.',
            },
            {
                file: 'shared/__tests__/errorSanitizer.test.ts',
                note: 'Fix: 20 unit tests cover every redaction path, control-char strip, allowlist collapse, and edge cases.',
            },
            {
                file: 'src/hooks/useSyncActions.ts',
                note: 'Fix: sanitizeError(rawMessage) applied at both error paths (isError=true + catch block). Integration test in useSyncActions.test.ts asserts the allowlist dump is collapsed and secret-shaped tokens are redacted.',
            },
        ],
        observed:
            'MCP error text flowed unsanitized into notificationStore.push. Two concrete risks: (a) the allowlist-rejection path dumped 12 tool names into the toast (UX noise + internal catalog exposure), and (b) any MCP tool whose error string accidentally included a secret-shaped token would surface that secret in plaintext in the renderer DOM.',
        rationale:
            'CHRON.1 already established the precedent for sanitizing user-visible error text. The pattern should be reused for any new user-visible error surface. Renderer toasts are rendered into the DOM — a leaked secret could be copy-pasted into screenshots, bug reports, or Slack threads.',
        proposedFix:
            'Create shared/errorSanitizer.ts mirroring reasonSanitizer. Apply at every pushNotification call site in useSyncActions.',
        scope: 'cross-file',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. New shared/errorSanitizer.ts + 20 unit tests + integration test in useSyncActions.test.ts.',
    },
    {
        id: 'WARN-3',
        title: 'ResolveStrategy validated at compile time only, not at dispatch (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 248,
                note: 'Original: dispatch("resolve", "flint_resolve_all", { strategy: effective }, …) with only TS type narrowing on `effective`.',
            },
            {
                file: 'src/components/ui/mint/ConfirmResolveDialog.tsx',
                line: 43,
                note: 'Dialog typed strategy as ResolveStrategy but callers could `as any` cast.',
            },
            {
                file: 'src/hooks/useSyncActions.ts',
                note: 'Fix: z.enum(["prefer-figma", "prefer-local"]).safeParse runs before dispatch. Invalid values set lastError and push a user-safe error toast without invoking mcp.callTool.',
            },
        ],
        observed:
            'ResolveStrategy is a TypeScript string literal union. TSC protects well-behaved callers but does nothing for `as any` casts or a compromised renderer constructing args manually. An attacker could push arbitrary strings into flint_resolve_all\'s strategy field.',
        rationale:
            'Defense in depth — renderer-side Zod guard catches malformed strategies before they reach the preload bridge. Upstream MCP tool validation is the safety net, not the first line.',
        proposedFix:
            'Add a one-line Zod parse in useSyncActions.resolve() before dispatch. On failure, route to error notification without invoking the tool.',
        scope: 'one-line',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. RESOLVE_STRATEGY_SCHEMA added at the top of useSyncActions.ts; parsed at resolve() entry. New test in useSyncActions.test.ts asserts invalid strategies never reach mcp.callTool.',
    },
    {
        id: 'SUG-1',
        title: 'mcpCallToolSchema is a catch-all z.record(z.unknown()) — per-tool schemas would tighten the bridge',
        severity: 'suggestion',
        evidence: [
            {
                file: 'shared/ipc-validators.ts',
                line: 261,
                excerpt:
                    '"mcp:call-tool": {\n    payload: z.tuple([\n      z.string().min(1),\n      z.record(z.unknown()),\n    ]),\n    response: z.unknown(),\n},',
            },
        ],
        observed:
            'The mcp:call-tool payload schema validates the tuple shape but accepts any record<unknown> for args. Typos in the hook ({ stratergy: "prefer-figma" }) pass validation and blow up at the MCP tool layer.',
        rationale:
            'Current behavior is acceptable — MCP tool errors surface cleanly in the toast. But the contract\'s Design-by-Contract guarantee is weaker than advertised. Phase 3 should split the schema by toolName.',
        proposedFix:
            'Phase 3: discriminated union keyed on toolName with a Zod schema per known tool. Non-blocking for Phase 2.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-2',
        title: 'Auth-expired classifier uses keyword substring match on human-readable MCP text',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 68,
                excerpt:
                    "function isAuthExpiredError(message: string): boolean {\n    const lower = message.toLowerCase()\n    return (\n        lower.includes('auth-expired') || …",
            },
            {
                file: 'flint-mcp/src/core/errorResponse.ts',
                line: 116,
                note: 'Upstream text "The connection was disconnected or the access token expired" matches the classifier today, but nothing enforces the wording contract.',
            },
        ],
        observed:
            'Persistent-vs-transient classification depends on substring-matching human-readable error text. If upstream wording changes, the renderer misclassifies silently — a behavioral regression with no type-system signal.',
        rationale:
            'Echoed as cross-reviewer consensus with code WARN-1. Not a security defect per se, but a hardening item: the signal driving a persistent UI chip is stringly-typed.',
        proposedFix:
            'Phase 3: add a structured status field to MCP error responses. Interim: widen keyword list to include "401", "403", "forbidden", "session", "reauth".',
        scope: 'cross-file',
        status: 'open',
    },
    {
        id: 'SUG-3',
        title: 'SyncActionCluster disconnected Connect button does not disable during other in-flight ops',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/mint/SyncActionCluster.tsx',
                line: 52,
                excerpt: 'disabled={syncOp === \'connect\'}',
            },
        ],
        observed:
            'The disconnected cluster only disables Connect on syncOp === "connect". If another op is in flight, Connect stays enabled.',
        rationale:
            'Serialization guard in the hook catches the double-dispatch, but the button communicates nothing to the user. Cross-reviewer consensus with code SUG-1.',
        proposedFix:
            'Change disabled={syncOp === "connect"} to disabled={syncOp !== null}.',
        scope: 'one-line',
        status: 'open',
    },
    {
        id: 'SUG-4',
        title: 'Confirm dialog backdrop-click policy is intentional but undocumented',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/mint/ConfirmPushDialog.tsx',
                line: 52,
                excerpt: '/* Backdrop — aria-hidden, layout only (no click-to-close per\n    COUNSEL.1.7 audit). */',
            },
        ],
        observed:
            'Both confirm dialogs intentionally do NOT close on backdrop click (only Cancel or Escape). This is correct per COUNSEL.1.7 precedent but is only documented inline in one dialog.',
        rationale:
            'Hardening item — future contributors may re-add click-to-close. A JSDoc at the component level (both dialogs) would surface the policy.',
        proposedFix:
            'Add JSDoc block at the top of ConfirmPushDialog and ConfirmResolveDialog explaining the no-backdrop-close policy with a link to COUNSEL.1.7.',
        scope: 'one-file',
        status: 'open',
    },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'security');

export const REPORT: ReviewReport = {
    meta: {
        phase: 'MINT.5.2',
        dimension: 'security',
        reviewer: 'flint-security-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            'Trust boundary (renderer ↔ main via mcp:call-tool)',
            'Preload bridge + web adapter validation',
            'Hook-level handling of attacker-controlled MCP error text',
            'Destructive-action gating (confirm dialogs)',
            'Per-tool arg validation on mcpCallToolSchema',
            'Renderer allowlist (SEC.3) + per-agent ACL (AGV.1) integration',
        ],
        markdownFile: 'mint-phase2-security-review-2026-04-18.md',
    },
    rubric: [
        { criterion: 'All renderer→main IPC channels declare AND call a Zod validator at the bridge', result: 'pass', evidence: 'validateIPC(mcp:call-tool, ...) now wired in both electron/preload.ts and src/adapters/web-api.ts', relatedFindings: ['WARN-1'] },
        { criterion: 'User-visible error text is sanitized for secrets, control chars, and internal catalog exposure before rendering', result: 'pass', evidence: 'shared/errorSanitizer.ts + useSyncActions applies sanitizeError at every pushNotification call', relatedFindings: ['WARN-2'] },
        { criterion: 'Destructive-action params (strategies, IDs) are validated at runtime, not just compile time', result: 'pass', evidence: 'RESOLVE_STRATEGY_SCHEMA Zod parse runs before mcp.callTool dispatch', relatedFindings: ['WARN-3'] },
        { criterion: 'Renderer allowlist is frozen and includes only read/report tools plus explicitly user-invoked sync tools', result: 'pass', evidence: 'shared/mcp-allowed-tools.ts; mcp-policy.test.ts asserts count=12 and explicit excluded list' },
        { criterion: 'Confirm dialogs gate destructive actions with role="dialog" + aria-modal + FocusTrap + Escape-to-cancel', result: 'pass', evidence: 'ConfirmPushDialog.tsx:60, ConfirmResolveDialog.tsx:60; tests assert focus trap and Escape behavior' },
        { criterion: 'No window.flintAPI access in Zustand store actions (IPC belongs in hooks)', result: 'pass', evidence: 'useSyncActions is a hook; no store imports window.flintAPI in Phase 2 diff' },
        { criterion: 'OAuth and other flow internals are not modified by Phase 2', result: 'pass', evidence: 'Contract nonGoal preserved; electron/figmaOAuth.ts untouched' },
        { criterion: 'mcpCallToolSchema narrows args per tool', result: 'fail', evidence: 'shared/ipc-validators.ts:261 uses z.record(z.unknown()); deferred to Phase 3 (SUG-1)', relatedFindings: ['SUG-1'] },
        { criterion: 'Auth-expired classification uses a structured signal', result: 'fail', evidence: 'keyword substring match on human-readable MCP text; deferred to Phase 3 (SUG-2)', relatedFindings: ['SUG-2'] },
    ],
    findings,
    counts,
    verdict,
    scopeCoverage: {
        reviewed: [
            'electron/preload.ts (mcp.callTool bridge)',
            'electron/mcp-policy.ts (renderer allowlist + checkToolAccess)',
            'shared/mcp-allowed-tools.ts (frozen allowlist)',
            'shared/ipc-validators.ts (mcp:call-tool schema + mcpCallToolSchema export)',
            'shared/errorSanitizer.ts (new helper)',
            'src/hooks/useSyncActions.ts (error handling, sanitization, Zod guard, copy)',
            'src/components/ui/mint/ConfirmPushDialog.tsx (destructive gating)',
            'src/components/ui/mint/ConfirmResolveDialog.tsx (destructive gating + FIX-8 button label)',
            'src/adapters/web-api.ts (web-parity mcp.callTool)',
            'electron/__tests__/mcp-policy.test.ts (allowlist contract)',
            'shared/__tests__/errorSanitizer.test.ts (20 tests)',
            'src/hooks/__tests__/useSyncActions.test.ts (sanitization + strategy guard tests)',
        ],
        skipped: [
            'OAuth flow internals — Phase 2 nonGoal',
            'MCP server child-process sandboxing — architectural, out of scope',
            'Figma API TLS / transport security — infra, not Phase 2',
            'UX / copy review — handled by parallel UX reviewer',
            'Code-style and architectural review — handled by parallel code reviewer',
        ],
    },
};
