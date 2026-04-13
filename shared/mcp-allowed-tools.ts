/**
 * Tools the renderer (Glass web or Electron) is allowed to invoke directly.
 * Single source of truth — imported by both server/index.ts and electron/mcp-policy.ts.
 *
 * Only read-oriented / report-generation tools are permitted. Write-oriented
 * tools (mutations, fixes, ingestion) are invoked by MCP agents through the
 * protocol, not by the renderer.
 */
export const RENDERER_ALLOWED_MCP_TOOLS: readonly string[] = Object.freeze([
  'flint_status',
  'flint_audit',
  'flint_debt_report',
  'flint_query_registry',
  'flint_generate_dbom',
  'flint_accessibility_report',
  'flint_audit_report',
])
