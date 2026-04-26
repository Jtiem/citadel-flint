/**
 * Tools the renderer (Glass web or Electron) is allowed to invoke directly.
 * Single source of truth — imported by both server/index.ts and electron/mcp-policy.ts.
 *
 * Three categories are permitted:
 *   1. **Read-oriented / report-generation** — the original SEC.3 set.
 *   2. **User-invoked sync actions (MINT.5 Phase 2)** — explicitly user-triggered
 *      from Glass UI, with destructive variants gated behind a confirm dialog
 *      (ConfirmPushDialog / ConfirmResolveDialog). `agentId='renderer'` is
 *      hardcoded in the IPC handler so AGV.4 dynamic trust tiers still apply.
 *   3. **Scout emit (MINT.5 Phase 3)** — `flint_emit_tokens` is added to support
 *      the EmitDropdown UI in TokenHealthBar. The tool is dryRun-by-default from
 *      the renderer's perspective (preview path is read-shaped; the destructive
 *      write-to-disk variant is gated behind ConfirmEmitDialog). `agentId='renderer'`
 *      is hardcoded in `useEmitTokens.ts` so AGV.4 trust tier policy still applies.
 *
 * Write-oriented agent-only tools (mutations, fixes, ingestion) remain
 * excluded — those are invoked by MCP agents through the protocol, not by
 * the renderer.
 */
export const RENDERER_ALLOWED_MCP_TOOLS: readonly string[] = Object.freeze([
  // SEC.3 original set — read-oriented / report-generation
  'flint_status',
  'flint_audit',
  'flint_debt_report',
  'flint_query_registry',
  'flint_generate_dbom',
  'flint_accessibility_report',
  'flint_audit_report',
  // MINT.5 Phase 2 — user-invoked sync actions (confirm-gated for destructive variants)
  'flint_sync_pull',
  'flint_sync_push',
  'flint_resolve_all',
  'flint_sync_check',
  'flint_figma_connect',
  // MINT.5 Phase 3 — Scout emit (dryRun-default; write variant gated by ConfirmEmitDialog)
  'flint_emit_tokens',
])
