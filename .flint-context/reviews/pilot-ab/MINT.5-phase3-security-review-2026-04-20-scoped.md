# MINT.5 Phase 3 — Security Review (Cheaper-Pilot Scoped)

- **Reviewer:** flint-security-reviewer (scoped)
- **Date:** 2026-04-20
- **Commit:** 1db3e7f
- **Scope:** process boundary + trust-model surfaces (Lever A)

## Verdict

`deriveVerdict()` → **APPROVE_WITH_NOTES**. No CRITICAL/HIGH findings in scope. 1 MEDIUM, 2 LOW, 1 INFO.

## Risk Summary

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 2
- INFO: 1

## Findings

### [MEDIUM] `file:read` self-hosting guard bypass admits arbitrary `demos/` + tmpdir reads
- **Location:** `server/index.ts:934-961`
- **Observed:** The web handler adds `extraAllowedRoots: [tmpRealRoot]` and a `selfHostCheck` exception for any path under `<serverRoot>/demos/`. The stated rationale is to unblock `tryAutoResume` + `beta:load-demo-project` flows.
- **Impact:** Renderer can now `file:read` **any** file under the OS temp directory (including other users' extracted archives, unrelated app caches) so long as the extension matches the allowlist (`.tsx|.ts|.jsx|.js|.html|.vue|.svelte`). The `demos/` exception also applies to subdirectories the repo may hold (symlinks, vendored demos). Reads only — no write vector — but it widens the SEC.5 "workspace boundary" invariant without a corresponding per-file allowlist.
- **Commandment:** 14 (Bypass Prohibition — reads via shared validator is fine, but the carve-out erodes the boundary).
- **Remediation:** Tighten the tmpdir acceptance to the specific `flint-demo-*` subdirectory that `beta:load-demo-project` extracts into (stash it on `activeProjectRoot` or a sibling variable and compare prefix). The `demos/` carve-out is lower risk because those files ship in the repo, but consider restricting to the specific demo subpaths surfaced in the LaunchScreen manifest rather than the entire subtree.
- **Status:** open

### [LOW] `mcp:call-tool` payload schema accepts arbitrary object shapes; only 5 tools have per-tool schemas
- **Location:** `shared/ipc-validators.ts:261-267` + `417-423`
- **Observed:** `mcpCallToolSchema` validates `[string, Record<string, unknown>]`. `MCP_TOOL_ARG_SCHEMAS` has strict schemas for the 5 sync tools; the other 8 allowlisted renderer tools (`flint_status`, `flint_audit`, `flint_debt_report`, `flint_query_registry`, `flint_generate_dbom`, `flint_accessibility_report`, `flint_audit_report`, `flint_emit_tokens`, `flint_figma_connect`) pass through with no shape gate.
- **Impact:** A compromised renderer could forward unexpected keys to these tools. Exploitation depends on downstream handler strictness in `flint-mcp`; most are read-oriented so blast radius is low, but `flint_emit_tokens` has a write path gated only by `ConfirmEmitDialog` (UI-side).
- **Commandment:** 9 (Process Boundary Law).
- **Remediation:** Add strict schemas for the remaining 8 allowlisted tools or document an explicit "read-only, pass-through" policy in the allowlist file.
- **Status:** open

### [LOW] Classification lookup tables match plain substrings — false-positive risk on benign text
- **Location:** `shared/mcp-classification.ts:40-78`
- **Observed:** Substrings like `401`, `429`, `unauthorized` are matched anywhere in the lowercased first content block. A tool output containing `"Found 401 tokens"` would classify as `auth-expired` and trigger the persistent Figma-connection-expired banner.
- **Impact:** UX degradation, not a security breach. Classification only decides banner persistence + copy; it never short-circuits the user-visible message (sanitizer runs after classification on the original raw text).
- **Commandment:** n/a (hygiene).
- **Remediation:** Consider anchoring status-code matches to word boundaries (`\b401\b`). Defer if the false-positive rate is empirically zero — only error-path text is classified.
- **Status:** open

### [INFO] Preload validation-gate correctly short-circuits IPC on bad args
- **Location:** `electron/preload.ts:810-829` + `server/index.ts:2594-2617`
- **Observed:** Both bridges construct a `validation-error` envelope locally and return it without invoking `ipcRenderer.invoke` / `mcpClient.callTool`. Invariant `validation-gate-zero-network` holds. Sanitized message uses issue path + message; no payload echo.
- **Commandment:** 9.
- **Status:** verified.

## Verified Controls

- No `fs`/`child_process`/`crypto`/`os` imports in `src/hooks/useSyncActions.ts`.
- No `ipcRenderer.send/invoke` in renderer scope — only `window.flintAPI.mcp.callTool`.
- `classifyMCPError` is a pure function (no I/O); consumed by both `electron/mcpClient.ts` and `server/mcpClient.ts` — single source of truth (R8).
- Sanitizer runs *after* classification and *before* surfacing (`useSyncActions.ts:185-189`), preserving signal words for detection while redacting before display.
- Renderer allowlist (`RENDERER_ALLOWED_MCP_TOOLS`) is `Object.freeze`-d and imported server-side; cannot be mutated from renderer.
- Resolve strategy validated with Zod at dispatch boundary (defense against `as any` in callers).
- `MCP_TOOL_ARG_SCHEMAS` entries use `.strict()` — unknown keys rejected on the 5 sync tools.
- `flint_resolve_conflict` has a schema but is not in the renderer allowlist — harmless (dead-code schema); worth documenting.

## Recommendations (priority order)

1. Narrow the `file:read` demos/tmpdir carve-out (MEDIUM).
2. Extend `MCP_TOOL_ARG_SCHEMAS` to cover all allowlisted tools (LOW).
3. Anchor status-code substring matches (LOW).

## Instrumentation

- Files read in scope: 6 full (ipc-validators, mcp-allowed-tools, mcp-classification, electron/mcpClient, server/mcpClient, useSyncActions) + 2 diffs (preload, server/index).
- Bytes read: ~73.2 KB (full files) + ~16.7 KB (diffs) ≈ **89.9 KB**.
- Out-of-scope reads: **0**.
- Original 2026-04-19 reviews consulted: **No** (independent pass as required).
