/**
 * MCP Tool Allowlist — electron/mcp-policy.ts
 *
 * Defines which MCP tools the renderer (Glass) is permitted to invoke
 * via the mcp:call-tool IPC channel. Tools not in this list are rejected
 * server-side in the main process.
 *
 * This is a security boundary: Glass is an observability layer and should
 * only call read-oriented or report-generation tools. Write-oriented tools
 * (mutations, fixes, ingestion) are invoked by MCP agents through the
 * protocol, not by the renderer.
 *
 * To add a new tool: append it to RENDERER_ALLOWED_MCP_TOOLS and document
 * the Glass call site that needs it.
 */

/**
 * Frozen array of MCP tool names the renderer is allowed to invoke.
 * Enforced by the mcp:call-tool handler in main.ts.
 *
 * Derived by auditing every mcp.callTool(...) call site in src/:
 *   - bridge_generate_dbom: ExportModal.tsx (DBOM download)
 *
 * Additional read-oriented / report-generation tools included because
 * Glass panels legitimately invoke them:
 *   - bridge_status: health check for status indicators
 *   - bridge_audit: governance audit (GovernanceOverlay, ExportModal pre-flight)
 *   - bridge_debt_report: health score (GovernanceDashboard)
 *   - bridge_query_registry: component search (Asset Management Hub)
 *   - bridge_accessibility_report: VPAT report (ExportModal compliance section)
 *   - bridge_audit_report: provenance report (ExportModal compliance summary)
 *
 * Explicitly excluded (write-oriented or agent-only):
 *   - bridge_ast_mutate: mutations go through editorStore.applyBatch → ast:save-file
 *   - bridge_fix: auto-fix triggers editorStore.applyBatch directly
 *   - bridge_ingest_figma: triggered by HTTP server route, not Glass
 *   - bridge_sync_tokens: triggered by ingestion server, not Glass
 *   - bridge_swarm_audit_fix: agent-only swarm orchestration
 *   - bridge_add_remote_library: agent-only library management
 *   - bridge_annotate: annotations created by MCP agents, Glass reads via annotations:read-all IPC
 */
export const RENDERER_ALLOWED_MCP_TOOLS: readonly string[] = Object.freeze([
    'bridge_status',
    'bridge_audit',
    'bridge_debt_report',
    'bridge_query_registry',
    'bridge_generate_dbom',
    'bridge_accessibility_report',
    'bridge_audit_report',
])
