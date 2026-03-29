/**
 * workflowGuide.test.ts
 *
 * Ensures the flint-workflow-guide prompt only references tool names that are
 * actually registered in the Flint MCP server.  Any phantom tool name in the
 * guide causes AI assistants to attempt calls that fail silently — this test
 * catches that class of error at CI time.
 */

import { describe, it, expect } from 'vitest';
import { getWorkflowGuideContent } from "../prompts/workflow-guide";

// ---------------------------------------------------------------------------
// The 54 registered tool names from CLAUDE.md / server.ts
// ---------------------------------------------------------------------------

const REGISTERED_TOOLS = new Set([
    "flint_status",
    "audit_ui_component",
    "hydrate_figma_data",
    "read_design_intent",
    "flint_ast_mutate",
    "flint_query_registry",
    "flint_audit",
    "flint_fix",
    "flint_swarm_audit_fix",
    "flint_ingest_figma",
    "flint_sync_tokens",
    "flint_audit_report",
    "flint_accessibility_report",
    "flint_generate_dbom",
    "flint_add_remote_library",
    "flint_plan",
    "flint_mutation_provenance",
    "flint_override_telemetry",
    "flint_agent_risk",
    "flint_anomaly_report",
    "flint_consensus_report",
    "flint_risk_score",
    "flint_debt_report",
    "flint_set_policy",
    "flint_get_context",
    "flint_assess_complexity",
    "flint_migrate_tw",
    "flint_migrate_config",
    "flint_agent_trust",
    "flint_figma_connect",
    "flint_sync_pull",
    "flint_sync_push",
    "flint_resolve_conflict",
    "flint_resolve_all",
    "flint_sync_check",
    "flint_sync_history",
    "flint_validate_themes",
    "flint_migrate_ds",
    "flint_universal_audit",
    "flint_enrich_registry",
    "flint_approve_enrichment",
    "flint_reindex_registry",
    "flint_emit_tokens",
    "flint_map_tokens",
    "flint_set_library",
    "flint_design_to_code",
    "flint_extract_tokens",
    "flint_approve_tokens",
    "flint_code_connect_sync",
    "flint_pull_variables",
    "flint_pack_export",
    "flint_pack_import",
    "flint_pack_rollback",
    "flint_defer_violation",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract every token that looks like a Flint tool name from a string.
 * Matches identifiers that start with "flint_" or are known non-prefixed
 * tools (audit_ui_component, hydrate_figma_data, read_design_intent).
 */
function extractToolNames(content: string): string[] {
    const toolPattern = /\b(flint_[a-z_]+|audit_ui_component|hydrate_figma_data|read_design_intent)\b/g;
    const matches = content.match(toolPattern) ?? [];
    return [...new Set(matches)];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("flint-workflow-guide prompt", () => {
    it("workflow guide references only registered tool names (no intent)", () => {
        const content = getWorkflowGuideContent();
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (figma intent)", () => {
        const content = getWorkflowGuideContent("import a Figma design");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (audit intent)", () => {
        const content = getWorkflowGuideContent("audit and fix violations");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (release intent)", () => {
        const content = getWorkflowGuideContent("pre-release accessibility gate VPAT 508");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (debt intent)", () => {
        const content = getWorkflowGuideContent("reduce design debt drift sprint");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (collab intent)", () => {
        const content = getWorkflowGuideContent("collaborative review team consensus annotate");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("workflow guide references only registered tool names (migration intent)", () => {
        const content = getWorkflowGuideContent("migrate tailwind tw4 design system change");
        const mentioned = extractToolNames(content);

        const phantoms = mentioned.filter((name) => !REGISTERED_TOOLS.has(name));

        expect(phantoms).toEqual([]);
    });

    it("previously phantom tool names are no longer present anywhere in the guide", () => {
        // Exhaustive check across all intent paths for every known phantom.
        const knownPhantoms = [
            "flint_vpat_report",
            "flint_platform_export",
            "flint_annotate",
            "flint_theme_validate",
            "flint_consensus_status",
        ];

        const intents = [
            undefined,
            "import figma",
            "audit component",
            "release gate VPAT",
            "design debt sprint",
            "team consensus annotate",
            "tailwind migrate",
            "new component",
        ];

        for (const intent of intents) {
            const content = getWorkflowGuideContent(intent);
            for (const phantom of knownPhantoms) {
                expect(content).not.toContain(phantom);
            }
        }
    });
});
