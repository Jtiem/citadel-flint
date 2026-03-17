import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "@babel/parser";
import _generate from "@babel/generator";
import { auditAll } from "./core/MithrilLinter.js";
import { A11yLinter } from "./core/A11yLinter.js";
import { HydroPasteEngine } from "./core/hydroPaste.js";
import { moveNode, injectComponent, applyTokenFix, assembleLayout, deleteNode, updateProp, updateClassName, updateTextContent, wrapNode } from "./core/ast-modifier.js";
import { TelemetryLogger } from "./core/telemetry.js";
import { formatMutationReceipt, formatAuditReport } from "./core/formatters.js";
import { queryRegistry, formatShadowStorybook } from "./core/registryService.js";
import { queryRAGRegistry } from "./core/ragRegistryService.js";
import type { DesignToken, LinterWarning, BridgeSDIPayload } from "./types.js";
import { bridgeEvents, EVENTS } from "./core/events.js";
import { resolveProjectRoot, loadConfig } from "./core/config-loader.js";
import { DEFAULT_CONFIG } from "./core/config.js";
import type { BridgeConfig, BridgePolicy } from "./core/config.js";
import { readPolicy, writePolicy, mergePolicy, getDefaultPolicy } from "./core/policyLoader.js";
import { handleBridgeAudit, handleBridgeAuditBatch, BRIDGE_AUDIT_TOOL } from "./tools/audit.js";
import { handleBridgeFix, BRIDGE_FIX_TOOL } from "./tools/fix.js";
import { handleBridgeSwarmAuditFix, BRIDGE_SWARM_AUDIT_FIX_TOOL } from "./tools/swarm.js";
import { handleBridgeIngest, BRIDGE_INGEST_TOOL } from "./tools/ingest.js";
import { handleBridgeSync, BRIDGE_SYNC_TOOL } from "./tools/sync.js";
import { handleAuditReport, BRIDGE_AUDIT_REPORT_TOOL } from "./tools/auditReport.js";
import { BRIDGE_SENTINEL_PROMPT_DEF, getBridgeSentinelContent } from "./prompts/sentinel.js";
import { CAPABILITIES_RESOURCE, readCapabilities } from "./core/capabilities/index.js";
import { WORKFLOW_GUIDE_PROMPT, getWorkflowGuideContent } from "./prompts/workflow-guide.js";
import { domainRegistry } from "./domains/index.js";
import { loadRulesFromDirectory } from "./core/rules/loader.js";
import { generateDebtReport, generateDashboard, formatReportAsMarkdown } from "./core/dashboard/debtReportService.js";
import { handleAccessibilityReport, BRIDGE_ACCESSIBILITY_REPORT_TOOL } from "./tools/accessibility.js";
import { handleGenerateDBOM, BRIDGE_GENERATE_DBOM_TOOL, getCachedDBOM } from "./tools/dbom.js";
import { formatDBOMAsMarkdown } from "./core/dbom/formatter.js";
import { handleBridgeAddRemoteLibrary, BRIDGE_ADD_REMOTE_LIBRARY_TOOL } from "./tools/remoteLibrary.js";
import { setRegistryCache as hydrateRAGCache } from "./core/ragRegistryService.js";
import { contextPushManager } from "./core/contextPush.js";
import { assembleSessionContext } from "./core/sessionContext.js";
import { assessComplexity } from "./core/complexityRouter.js";
import { enrichToolCall, enrichToolResult } from "./core/toolEnricher.js";
import BetterSqlite3 from "better-sqlite3";
import { MutationProvenanceService } from "./core/governance/mutationProvenanceService.js";
import { OverrideTelemetryService } from "./core/governance/overrideTelemetryService.js";
import type { ProvenanceSource, OverrideEvent } from "./core/governance/types.js";
import { scoreMutation as mrsScoremutation } from "./core/governance/riskScoringService.js";
import { validateSessionState } from "./core/governance/sessionValidator.js";
import type { SessionMutation } from "./core/governance/sessionValidator.js";
import { handleBridgePlan, BRIDGE_PLAN_TOOL } from "./tools/plan.js";
import type { BridgePlanParams } from "./tools/plan.js";
import { loadProjectContext } from "./core/projectContext.js";
import { AgentRiskService } from "./core/governance/agentRiskService.js";
import { AnomalyDetectionService } from "./core/governance/anomalyDetectionService.js";
import type { AgentRiskSummary } from "./core/governance/types.js";

// @ts-ignore
const generate = _generate.default || _generate;

// ---------------------------------------------------------------------------
// Provenance singleton — one MutationProvenanceService per project root,
// backed by a file-based SQLite database at <root>/.bridge/provenance.db
// ---------------------------------------------------------------------------

const _provenanceServices = new Map<string, MutationProvenanceService>();

function getProvenanceService(projectRoot: string): MutationProvenanceService {
    const existing = _provenanceServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, ".bridge");
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "provenance.db"));
    const service = new MutationProvenanceService(db);
    _provenanceServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Override Telemetry singleton — one OverrideTelemetryService per project root,
// backed by a file-based SQLite database at <root>/.bridge/overrides.db
// ---------------------------------------------------------------------------

const _overrideServices = new Map<string, OverrideTelemetryService>();

function getOverrideTelemetryService(projectRoot: string): OverrideTelemetryService {
    const existing = _overrideServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, ".bridge");
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "overrides.db"));
    const service = new OverrideTelemetryService(db);
    _overrideServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Agent Risk singleton — AGV.2: one AgentRiskService per project root,
// reuses the provenance.db and overrides.db connections.
// ---------------------------------------------------------------------------

const _agentRiskServices = new Map<string, AgentRiskService>();

function getAgentRiskService(projectRoot: string): AgentRiskService {
    const existing = _agentRiskServices.get(projectRoot);
    if (existing !== undefined) return existing;

    // Reuse the provenance and override service DB connections
    const dbDir = path.join(projectRoot, ".bridge");
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const provenanceDb = new BetterSqlite3(path.join(dbDir, "provenance.db"));
    const overridesDb = new BetterSqlite3(path.join(dbDir, "overrides.db"));
    const service = new AgentRiskService(provenanceDb, overridesDb);
    _agentRiskServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Anomaly Detection singleton — GOV.4: one AnomalyDetectionService per project root,
// backed by a file-based SQLite database at <root>/.bridge/anomalies.db
// ---------------------------------------------------------------------------

const _anomalyServices = new Map<string, AnomalyDetectionService>();

function getAnomalyDetectionService(projectRoot: string): AnomalyDetectionService {
    const existing = _anomalyServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, ".bridge");
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "anomalies.db"));
    const service = new AnomalyDetectionService(db);
    _anomalyServices.set(projectRoot, service);
    return service;
}

/** Active project configuration — initialised in runServer() */
let bridgeConfig: BridgeConfig = DEFAULT_CONFIG;

const server = new Server(
    {
        name: "bridge-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
        instructions:
            "Bridge is a governance engine that enforces design systems, accessibility, " +
            "and brand compliance at the AST level. " +
            "New to Bridge? Start with the bridge-workflow-guide prompt or read " +
            "bridge://capabilities for the full tool catalog. " +
            "For project health at a glance, call bridge_get_context with your projectRoot.",
    }
);

/**
 * List available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "bridge_status",
                description: "Read the status of the Bridge MCP server.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "audit_ui_component",
                description: "Run Mithril and A11y audits on a UI component file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        componentPath: {
                            type: "string",
                            description: "Absolute path to the .tsx or .jsx file to audit.",
                        },
                    },
                    required: ["componentPath"],
                },
            },
            {
                name: "hydrate_figma_data",
                description: "Convert a Figma AST payload into React component snippets.",
                inputSchema: {
                    type: "object",
                    properties: {
                        figmaPayload: {
                            type: "string",
                            description: "JSON string of the Figma AST payload from the Bridge Figma plugin.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (where bridge-manifest.json resides).",
                        },
                    },
                    required: ["figmaPayload", "projectRoot"],
                },
            },
            {
                name: "read_design_intent",
                description: "Reads the current design intent pushed from Figma (.bridge/current-intent.json) and returns a typed Execution Plan for the AI agent to implement.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: "bridge_ast_mutate",
                description: "Apply a batch of structural mutations (move, inject, fix token, updateProp) to a file AST. This is the only approved way to modify code.",
                inputSchema: {
                    type: "object",
                    properties: {
                        targetPath: {
                            type: "string",
                            description: "Absolute path to the file to modify.",
                        },
                        mutations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: {
                                        type: "string",
                                        enum: ["move", "inject", "fixToken", "assembleLayout", "updateProp", "updateClassName", "updateTextContent"],
                                    },
                                    args: {
                                        type: "object",
                                    },
                                },
                                required: ["type", "args"],
                            },
                        },
                        writeFile: {
                            type: "boolean",
                            description: "Whether to write the resulting code back to the file. Defaults to false.",
                        },
                        dryRun: {
                            type: "boolean",
                            description:
                                "When true, returns the full mutation result (what would change) " +
                                "without writing to disk, recording provenance, or computing risk scores. " +
                                "Use this for previewing mutations before committing them.",
                        },
                    },
                    required: ["targetPath", "mutations"],
                },
            },
            {
                name: "bridge_query_registry",
                description: "Searches the Bridge UI component registry using both vector semantic search and text relevance. Returns a Shadow Storybook artifact with TypeScript interfaces and import paths.",
                inputSchema: {
                    type: "object",
                    properties: {
                        semantic_query: {
                            type: "string",
                            description: "A natural language description of the UI element needed.",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum matches (default 3).",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root.",
                        },
                    },
                    required: ["semantic_query", "projectRoot"],
                },
            },
            BRIDGE_AUDIT_TOOL,
            BRIDGE_FIX_TOOL,
            BRIDGE_SWARM_AUDIT_FIX_TOOL,
            BRIDGE_INGEST_TOOL,
            BRIDGE_SYNC_TOOL,
            BRIDGE_AUDIT_REPORT_TOOL,
            BRIDGE_ACCESSIBILITY_REPORT_TOOL,
            BRIDGE_GENERATE_DBOM_TOOL,
            BRIDGE_ADD_REMOTE_LIBRARY_TOOL,
            BRIDGE_PLAN_TOOL,
            {
                name: "bridge_mutation_provenance",
                description: "Query the Mutation Provenance Ledger (V.2-mp). Returns who or what caused each AST mutation: human, agent, auto-heal, auto-fix, or import. Supports provenance summary (aggregate counts) and per-file audit trail.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["summary", "audit_trail", "by_source"],
                            description: "'summary' — aggregate counts by source + top agents. 'audit_trail' — chronological history for a file. 'by_source' — list recent mutations by source type.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                        filePath: {
                            type: "string",
                            description: "Required for action='audit_trail'. Absolute path to the file.",
                        },
                        source: {
                            type: "string",
                            enum: ["human", "agent", "auto-heal", "auto-fix", "import"],
                            description: "Required for action='by_source'. Filter by provenance source.",
                        },
                        startDate: {
                            type: "string",
                            description: "ISO 8601 UTC lower bound for 'audit_trail' (inclusive).",
                        },
                        endDate: {
                            type: "string",
                            description: "ISO 8601 UTC upper bound for 'audit_trail' (inclusive).",
                        },
                        limit: {
                            type: "number",
                            description: "Max rows for 'by_source' (default: 100).",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: "bridge_override_telemetry",
                description: "Query the Override Telemetry Ledger (GOV.2). Returns override events — every governance rule bypass, disable, or severity downgrade. Supports summary (aggregate counts), by_session, and by_rule queries.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["summary", "by_session", "by_rule"],
                            description: "'summary' — aggregate counts by rule + session + last 24h. 'by_session' — list overrides for a session. 'by_rule' — list overrides for a rule.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                        sessionId: {
                            type: "string",
                            description: "Required for action='by_session'. Session UUID to filter by.",
                        },
                        ruleId: {
                            type: "string",
                            description: "Required for action='by_rule'. Rule ID to filter by.",
                        },
                        limit: {
                            type: "number",
                            description: "Max rows for 'by_session' and 'by_rule' (default: 100).",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: "bridge_agent_risk",
                description: "Query the Agent Risk Dashboard (AGV.2). Returns per-agent risk profiles — mutation counts, average MRS scores, red/amber/green tier breakdown, override counts. Supports 'summary' (all agents) and 'by_agent' (single agent) actions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["summary", "by_agent"],
                            description: "'summary' — all agents ranked by risk. 'by_agent' — single agent profile.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                        agentId: {
                            type: "string",
                            description: "Required for action='by_agent'. Agent ID to query.",
                        },
                        periodDays: {
                            type: "number",
                            description: "Number of days to look back (default: 7).",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: "bridge_anomaly_report",
                description: "Statistical anomaly detection (GOV.4). Computes baselines from historical governance data and flags anomalies at 3-sigma threshold. Detects override spikes, violation surges, velocity spikes, risk drift, and agent behavior changes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["detect", "history", "baseline"],
                            description: "'detect' — run anomaly detection now. 'history' — past anomalies. 'baseline' — view current baseline stats.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                        windowDays: {
                            type: "number",
                            description: "Number of past days for baseline computation (default: 30).",
                        },
                        limit: {
                            type: "number",
                            description: "Max rows for 'history' action (default: 50).",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: "bridge_debt_report",
                description: "Generate a project-wide design debt report — aggregated Mithril violations, A11y issues, and token drift hotspots. Returns a health score (0-100), letter grade (A-F), violation breakdown by severity/category/file, and trend tracking.",
                inputSchema: {
                    type: "object",
                    properties: {
                        glob: {
                            type: "string",
                            description: "File glob pattern to scan (default: '**/*.tsx').",
                        },
                        format: {
                            type: "string",
                            enum: ["json", "markdown"],
                            description: "Output format (default: 'json').",
                        },
                        track: {
                            type: "boolean",
                            description: "If true, append a snapshot to .bridge/debt-history.json for trend tracking (default: false).",
                        },
                    },
                },
            },
            {
                name: "bridge_set_policy",
                description: "Read, update, or reset the project governance policy (.bridge/policy.json). Controls Mithril ΔE thresholds, A11y enforcement mode, export gate behaviour, and more.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["read", "update", "reset"],
                            description: "Action: 'read' returns current policy, 'update' merges partial changes, 'reset' restores defaults.",
                        },
                        policy: {
                            type: "object",
                            description: "Partial policy object to merge (only used with action='update'). Top-level keys: mithril, a11y, export_gate, baseline.",
                        },
                    },
                    required: ["action"],
                },
            },
            {
                name: "bridge_get_context",
                description: "Returns the full Bridge session context — active file, violations, tokens, mutations, health, and canvas state. Call this FIRST at the start of any session to eliminate cold-start round-trips.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .bridge directory).",
                        },
                        includeSource: {
                            type: "boolean",
                            description: "Whether to include the first 200 lines of the active file source. Default true.",
                        },
                        includeViolationDetails: {
                            type: "boolean",
                            description: "Whether to include full violation details. Default true.",
                        },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: "bridge_assess_complexity",
                description: "Analyze the complexity of a proposed task and recommend the appropriate AI model tier (fast/balanced/powerful). Use this before starting complex multi-step workflows.",
                inputSchema: {
                    type: "object",
                    properties: {
                        taskDescription: {
                            type: "string",
                            description: "Natural language description of the task to assess.",
                        },
                        estimatedNodeCount: {
                            type: "number",
                            description: "Estimated number of AST nodes that will be affected.",
                        },
                        crossFile: {
                            type: "boolean",
                            description: "Whether the task spans multiple source files.",
                        },
                        filePaths: {
                            type: "array",
                            items: { type: "string" },
                            description: "Absolute paths to files involved in the task.",
                        },
                        mutationTypes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Mutation types that will be used.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Project root for context lookup. Optional.",
                        },
                    },
                    required: ["taskDescription"],
                },
            },
        ],
    };
});

/**
 * List available resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            CAPABILITIES_RESOURCE,
            {
                uri: "bridge://session-context",
                name: "Bridge Session Context",
                mimeType: "application/json",
                description: "Rich session context snapshot — active file, violations, tokens, health score, recent mutations. Read this FIRST to eliminate cold-start round-trips. Assembly budget < 100ms.",
            },
            {
                uri: "bridge://tokens",
                name: "Bridge Design Tokens",
                mimeType: "application/json",
                description: "The current set of normalized design tokens from .bridge/design-tokens.json"
            },
            {
                uri: "bridge://manifest",
                name: "Bridge Project Manifest",
                mimeType: "application/json",
                description: "The global architecture manifest (bridge-manifest.json) defining codebase components and logic."
            },
            {
                uri: "bridge://rules",
                name: "Bridge Governance Rules",
                mimeType: "application/json",
                description: "All loaded governance rules, grouped by domain."
            },
            {
                uri: "bridge://violations/{filePath}",
                name: "Bridge Violations",
                mimeType: "application/json",
                description: "Live governance audit for a specific file path."
            },
            {
                uri: "bridge://dashboard",
                name: "Bridge Design Debt Dashboard",
                mimeType: "application/json",
                description: "Design debt dashboard — current health score, letter grade, violation summary, and last 10 trend snapshots from .bridge/debt-history.json."
            },
            {
                uri: "bridge://policy",
                name: "Bridge Governance Policy",
                mimeType: "application/json",
                description: "The active governance policy (.bridge/policy.json) — Mithril thresholds, A11y mode, export gate settings."
            },
            {
                uri: "bridge://dbom",
                name: "Bridge Design Bill of Materials",
                mimeType: "application/json",
                description: "Design Bill of Materials (DBOM) — machine-readable manifest of all design tokens, component compliance, token coverage, and governance status. Regenerated on demand; returns cached result if available."
            },
            {
                uri: "bridge://overrides",
                name: "Bridge Override Telemetry",
                mimeType: "application/json",
                description: "Override telemetry summary — total count, overrides by rule, by session, last 24h count, and last override timestamp. GOV.2."
            },
            {
                uri: "bridge://agent-risk",
                name: "Bridge Agent Risk Dashboard",
                mimeType: "application/json",
                description: "Per-agent risk profiles — mutation counts, average risk scores, red/amber/green tier breakdown, override counts. AGV.2."
            },
            {
                uri: "bridge://anomalies",
                name: "Bridge Anomaly Detection",
                mimeType: "application/json",
                description: "Current anomaly count and latest detected anomalies from statistical baseline analysis. GOV.4."
            }
        ]
    };
});

/**
 * Read a specific resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const projectRoot = process.cwd();

    if (request.params.uri === "bridge://capabilities") {
        return {
            contents: [{
                uri: "bridge://capabilities",
                mimeType: "application/json",
                text: readCapabilities(),
            }]
        };
    }

    if (request.params.uri === "bridge://tokens") {
        const tokensPath = path.join(projectRoot, ".bridge", "design-tokens.json");
        if (!fs.existsSync(tokensPath)) {
            throw new Error(`Design tokens file not found at ${tokensPath}`);
        }
        return {
            contents: [{
                uri: "bridge://tokens",
                mimeType: "application/json",
                text: fs.readFileSync(tokensPath, "utf-8")
            }]
        };
    }

    if (request.params.uri === "bridge://manifest") {
        const manifestPath = path.join(projectRoot, "bridge-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Manifest file not found at ${manifestPath}`);
        }
        return {
            contents: [{
                uri: "bridge://manifest",
                mimeType: "application/json",
                text: fs.readFileSync(manifestPath, "utf-8")
            }]
        };
    }

    if (request.params.uri === "bridge://rules") {
        const allRules: Record<string, unknown[]> = {};
        for (const domainId of domainRegistry.list()) {
            const domain = domainRegistry.get(domainId);
            if (!domain) continue;
            if (fs.existsSync(domain.rulesPath)) {
                try {
                    const rules = await loadRulesFromDirectory(domain.rulesPath);
                    allRules[domainId] = rules;
                } catch {
                    allRules[domainId] = [];
                }
            } else {
                allRules[domainId] = [];
            }
        }
        return {
            contents: [{
                uri: "bridge://rules",
                mimeType: "application/json",
                text: JSON.stringify(allRules, null, 2),
            }]
        };
    }

    if (request.params.uri === "bridge://dashboard") {
        const dashboard = generateDashboard(projectRoot);
        return {
            contents: [{
                uri: "bridge://dashboard",
                mimeType: "application/json",
                text: JSON.stringify(dashboard, null, 2),
            }]
        };
    }

    if (request.params.uri === "bridge://policy") {
        const policy = readPolicy(projectRoot);
        return {
            contents: [{
                uri: "bridge://policy",
                mimeType: "application/json",
                text: JSON.stringify(policy, null, 2),
            }]
        };
    }

    if (request.params.uri === "bridge://dbom") {
        // Serve cached DBOM if available; otherwise generate fresh.
        const cached = getCachedDBOM();
        let dbom = cached;
        if (dbom === null) {
            dbom = await (await import("./core/dbom/generator.js")).generateDBOM(projectRoot);
        }
        return {
            contents: [{
                uri: "bridge://dbom",
                mimeType: "application/json",
                text: JSON.stringify(dbom, null, 2),
            }]
        };
    }

    if (request.params.uri === "bridge://session-context") {
        const sessionCtx = await assembleSessionContext(projectRoot);
        return {
            contents: [{
                uri: "bridge://session-context",
                mimeType: "application/json",
                text: JSON.stringify(sessionCtx, null, 2),
            }]
        };
    }

    if (request.params.uri === "bridge://overrides") {
        try {
            const overrideSvc = getOverrideTelemetryService(projectRoot);
            const summary = overrideSvc.getOverrideSummary(projectRoot);
            return {
                contents: [{
                    uri: "bridge://overrides",
                    mimeType: "application/json",
                    text: JSON.stringify(summary, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: "bridge://overrides",
                    mimeType: "application/json",
                    text: JSON.stringify({ totalOverrides: 0, byRule: [], bySession: [], last24hCount: 0, lastOverrideAt: null }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri === "bridge://agent-risk") {
        try {
            const svc = getAgentRiskService(projectRoot);
            const summary = svc.getAgentRiskSummary(projectRoot);
            return {
                contents: [{
                    uri: "bridge://agent-risk",
                    mimeType: "application/json",
                    text: JSON.stringify(summary, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: "bridge://agent-risk",
                    mimeType: "application/json",
                    text: JSON.stringify({ agents: [], topRiskiest: [], period: "last_7_days" }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri === "bridge://anomalies") {
        try {
            const svc = getAnomalyDetectionService(projectRoot);
            const history = svc.getAnomalyHistory(projectRoot, 10);
            return {
                contents: [{
                    uri: "bridge://anomalies",
                    mimeType: "application/json",
                    text: JSON.stringify({ count: history.length, anomalies: history }, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: "bridge://anomalies",
                    mimeType: "application/json",
                    text: JSON.stringify({ count: 0, anomalies: [] }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri.startsWith("bridge://violations/")) {
        const filePath = "/" + request.params.uri.replace("bridge://violations/", "");
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const source = fs.readFileSync(filePath, "utf-8");
        const auditResult = await handleBridgeAudit({ source, filePath }, bridgeConfig);
        return {
            contents: [{
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(auditResult, null, 2),
            }]
        };
    }

    throw new Error(`Unknown resource: ${request.params.uri}`);
});

/**
 * List available prompts.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "bridge-intent-composer",
                description: "The primary directive for the Bridge UX/UI Architecture Sentinel. Use this when drafting or modifying UI components based on Figma design intent.",
            },
            BRIDGE_SENTINEL_PROMPT_DEF,
            WORKFLOW_GUIDE_PROMPT,
        ]
    };
});

/**
 * Handle get prompt request.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "bridge-intent-composer") {
        return {
            description: "Bridge UX/UI Architecture Sentinel Persona",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `You are the Bridge UX/UI Architecture Sentinel. You operate under the Bridge Containment Field. 

Your objective is to translate design intent from Figma into high-fidelity React code while maintaining strict design system integrity.

COMMANDMENTS:
1. You MUST read the design tokens from bridge://tokens to resolve all styles.
2. You MUST call bridge_query_registry before drafting any UI components to ensure you use existing design system components.
3. You MUST run all drafted code through the audit_ui_component tool to verify Mithril and A11y compliance.
4. You MUST ONLY use apply_ast_mutations to commit changes to the codebase. Raw string replacements or regex-based edits are strictly prohibited (Commandment 13 & 15).

HALT CRITERIA:
If you encounter a "BLOCKED" status from any tool (Mithril violation, A11y violation, or design drift), you must immediately halt execution. Display the "Bridge Ledger" artifact to the user detailing the violations and refuse to commit the code until the issues are resolved.
`
                    }
                }
            ]
        };
    }

    if (request.params.name === "bridge-sentinel") {
        const domain = (request.params.arguments as Record<string, string> | undefined)?.domain ?? "general";
        return {
            description: `Bridge Governance Engine — ${domain} domain persona`,
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getBridgeSentinelContent(domain),
                    },
                }
            ]
        };
    }

    if (request.params.name === "bridge-workflow-guide") {
        const intent = (request.params.arguments as Record<string, string> | undefined)?.intent;
        return {
            description: "Bridge MCP workflow composition guide — maps user intent to multi-tool sequences",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getWorkflowGuideContent(intent),
                    },
                }
            ]
        };
    }

    throw new Error(`Unknown prompt: ${request.params.name}`);
});

/**
 * Handle tool execution.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
        case "bridge_get_context": {
            const { projectRoot: ctxRoot } = request.params.arguments as { projectRoot: string };
            if (!ctxRoot || typeof ctxRoot !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "bridge_get_context: 'projectRoot' parameter is required." }],
                };
            }
            const sessionCtx = await assembleSessionContext(ctxRoot);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(sessionCtx, null, 2),
                }],
            };
        }

        case "bridge_assess_complexity": {
            const complexityArgs = request.params.arguments as {
                taskDescription: string;
                estimatedNodeCount?: number;
                crossFile?: boolean;
                filePaths?: string[];
                mutationTypes?: string[];
                projectRoot?: string;
            };
            if (!complexityArgs.taskDescription) {
                return {
                    isError: true,
                    content: [{ type: "text", text: "bridge_assess_complexity: 'taskDescription' parameter is required." }],
                };
            }
            let ctxForComplexity = null;
            if (complexityArgs.projectRoot) {
                try {
                    ctxForComplexity = await assembleSessionContext(complexityArgs.projectRoot);
                } catch {
                    // graceful — proceed without context
                }
            }
            const complexityResult = assessComplexity(
                {
                    taskDescription: complexityArgs.taskDescription,
                    estimatedNodeCount: complexityArgs.estimatedNodeCount,
                    crossFile: complexityArgs.crossFile,
                    filePaths: complexityArgs.filePaths,
                    mutationTypes: complexityArgs.mutationTypes,
                },
                ctxForComplexity,
            );
            return {
                content: [{ type: "text", text: JSON.stringify(complexityResult, null, 2) }],
            };
        }

        case "bridge_status": {
            return {
                content: [
                    {
                        type: "text",
                        text: "Bridge Protocol Active: Standalone Mode. Mithril, A11y, Figma Hydration, and AST Mutation engines ready.",
                    },
                ],
            };
        }

        case "audit_ui_component": {
            const { componentPath } = request.params.arguments as { componentPath: string };

            if (!fs.existsSync(componentPath)) {
                throw new Error(`File not found: ${componentPath}`);
            }

            const code = fs.readFileSync(componentPath, "utf-8");

            const projectRoot = findProjectRoot(componentPath);
            if (!projectRoot) {
                throw new Error("Could not find project root (.bridge directory)");
            }
            const telemetry = new TelemetryLogger(projectRoot);

            const tokensPath = path.join(projectRoot, ".bridge", "design-tokens.json");
            let tokens: DesignToken[] = [];

            if (fs.existsSync(tokensPath)) {
                try {
                    const rawTokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
                    tokens = Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens);
                } catch (e) {
                    console.error("Failed to parse design-tokens.json", e);
                }
            }

            try {
                const ast = parse(code, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                });

                const policyOpts = {
                    deltaE_threshold: bridgeConfig.policy.mithril.deltaE_threshold,
                    deltaE_critical_threshold: bridgeConfig.policy.mithril.deltaE_critical_threshold,
                };
                const mithrilWarnings = bridgeConfig.policy.mithril.mode !== 'off'
                    ? auditAll(ast as any, tokens, policyOpts)
                    : new Map();
                const a11yViolations = bridgeConfig.policy.a11y.mode !== 'off'
                    ? A11yLinter.audit(ast as any)
                    : {};

                let outcome = "Approved";
                if (mithrilWarnings.size > 0 || Object.keys(a11yViolations).length > 0) {
                    const firstMithril = Array.from(mithrilWarnings.values())[0];
                    if (firstMithril) {
                        outcome = `Blocked: ${firstMithril.message}`;
                    } else {
                        outcome = `Blocked: A11y Violations (${Object.keys(a11yViolations).length})`;
                    }
                }

                telemetry.log({
                    tool: "audit_ui_component",
                    input_summary: `Auditing ${path.basename(componentPath)}`,
                    outcome,
                    metadata: JSON.stringify({ mithrilCount: mithrilWarnings.size, a11yCount: Object.keys(a11yViolations).length })
                });

                const mithrilCount = mithrilWarnings.size;
                const a11yCount = Object.keys(a11yViolations).length;
                const hasViolations = mithrilCount > 0 || a11yCount > 0;
                const formatted = formatAuditReport(componentPath, mithrilWarnings, a11yViolations, tokens);

                // CX.1: summary sentence for audit_ui_component
                const auditComponentBasename = path.basename(componentPath);
                const auditComponentSummary = hasViolations
                    ? `Blocked: ${mithrilCount} Mithril + ${a11yCount} A11y violation(s) in ${auditComponentBasename}.`
                    : `No violations in ${auditComponentBasename}. Component is export-ready.`;

                if (hasViolations) {
                    return {
                        isError: true,
                        content: [
                            { type: "text", text: auditComponentSummary },
                            { type: "text", text: formatted },
                        ],
                    };
                }

                return {
                    content: [
                        { type: "text", text: auditComponentSummary },
                        { type: "text", text: formatted },
                    ],
                };
            } catch (err: any) {
                telemetry.log({
                    tool: "audit_ui_component",
                    input_summary: `Auditing ${path.basename(componentPath)}`,
                    outcome: `Blocked: Parsing Error ${err.message}`,
                    metadata: JSON.stringify({ error: err.message })
                });

                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Parsing Error: ${err.message}`,
                        },
                    ],
                };
            }
        }

        case "hydrate_figma_data": {
            const { figmaPayload, projectRoot } = request.params.arguments as { figmaPayload: string; projectRoot: string };

            if (!fs.existsSync(projectRoot)) {
                throw new Error(`Project root not found: ${projectRoot}`);
            }

            const manifestPath = path.join(projectRoot, "bridge-manifest.json");
            let manifest = { components: {}, resolvers: [] };
            if (fs.existsSync(manifestPath)) {
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                } catch (e) {
                    console.error("Failed to parse bridge-manifest.json", e);
                }
            }

            const tokensPath = path.join(projectRoot, ".bridge", "design-tokens.json");
            let tokens: DesignToken[] = [];
            if (fs.existsSync(tokensPath)) {
                try {
                    const rawTokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
                    tokens = Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens);
                } catch (e) {
                    console.error("Failed to parse design-tokens.json", e);
                }
            }

            const engine = new HydroPasteEngine(manifest, tokens);
            const result = await engine.processPayload(figmaPayload);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }

        case "bridge_ast_mutate": {
            const { targetPath, mutations, writeFile } = request.params.arguments as {
                targetPath: string;
                mutations: Array<{ type: string; args: any }>;
                writeFile?: boolean;
            };

            // CX.1: dryRun alias — when true, force writeFile=false, skip provenance + MRS
            const dryRunMutate = !!(request.params.arguments as any).dryRun;
            const effectiveWriteFile = dryRunMutate ? false : !!writeFile;

            if (!fs.existsSync(targetPath)) {
                throw new Error(`File not found: ${targetPath}`);
            }

            const projectRoot = findProjectRoot(targetPath);
            if (!projectRoot) {
                throw new Error("Could not find project root (.bridge directory)");
            }
            const telemetry = new TelemetryLogger(projectRoot);

            const code = fs.readFileSync(targetPath, "utf-8");
            let ast;
            try {
                ast = parse(code, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                });
            } catch (err: any) {
                telemetry.log({
                    tool: "bridge_ast_mutate",
                    input_summary: `Mutating ${path.basename(targetPath)}`,
                    outcome: `Blocked: Parsing Error ${err.message}`,
                    metadata: JSON.stringify({ error: err.message })
                });
                throw new Error(`Failed to parse target file: ${err.message}`);
            }

            for (const mutation of mutations) {
                switch (mutation.type) {
                    case "move": {
                        const { sourceId, targetId, position } = mutation.args;
                        ast = moveNode(ast as any, sourceId, targetId, position);
                        break;
                    }
                    case "inject": {
                        const { targetNodeId, jsxSnippet, importSnippet } = mutation.args;
                        ast = injectComponent(ast as any, targetNodeId, jsxSnippet, importSnippet);
                        break;
                    }
                    case "fixToken": {
                        const { nodeId, hardcodedClass, tokenClass } = mutation.args;
                        ast = applyTokenFix(ast as any, nodeId, hardcodedClass, tokenClass);
                        break;
                    }
                    case "assembleLayout": {
                        const { targetNodeId, payload } = mutation.args;
                        ast = assembleLayout(ast as any, targetNodeId, payload);
                        break;
                    }
                    case "updateProp": {
                        const { nodeId, propName, value } = mutation.args;
                        ast = updateProp(ast as any, nodeId, propName, value);
                        break;
                    }
                    case "updateClassName": {
                        const { nodeId, className } = mutation.args;
                        ast = updateClassName(ast as any, nodeId, className);
                        break;
                    }
                    case "updateTextContent": {
                        const { nodeId, text } = mutation.args;
                        ast = updateTextContent(ast as any, nodeId, text);
                        break;
                    }
                    case "delete": {
                        const { nodeId } = mutation.args;
                        ast = deleteNode(ast as any, nodeId);
                        break;
                    }
                    case "wrap": {
                        const { nodeId, wrapperElement } = mutation.args;
                        ast = wrapNode(ast as any, nodeId, wrapperElement);
                        break;
                    }
                    default:
                        console.warn(`Unknown mutation type: ${mutation.type}`);
                }
            }

            const { code: newCode } = generate(ast);
            const batchId = crypto.randomUUID();

            if (effectiveWriteFile) {
                fs.writeFileSync(targetPath, newCode, "utf-8");
                telemetry.log({
                    tool: "bridge_ast_mutate",
                    input_summary: `Mutated ${path.basename(targetPath)} (${mutations.length} mutations)`,
                    outcome: "Success",
                    metadata: JSON.stringify({ mutationsCount: mutations.length, batchId })
                });
            } else {
                telemetry.log({
                    tool: "bridge_ast_mutate",
                    input_summary: `Dry run mutation for ${path.basename(targetPath)}`,
                    outcome: "Approved",
                    metadata: JSON.stringify({ mutationsCount: mutations.length, batchId })
                });
            }

            // CX.1: Build summary for bridge_ast_mutate
            const mutateBasename = path.basename(targetPath);
            const mutateOpCounts = new Map<string, number>();
            for (const m of mutations) {
                const opType = (m as Record<string, unknown>).type as string ?? 'unknown';
                mutateOpCounts.set(opType, (mutateOpCounts.get(opType) ?? 0) + 1);
            }
            const opListParts: string[] = [];
            for (const [opType, count] of mutateOpCounts) {
                opListParts.push(count > 1 ? `${opType} (x${count})` : opType);
            }
            const opList = opListParts.join(', ') || 'none';
            const mutateSummary = dryRunMutate
                ? `DRY RUN -- ${mutations.length} mutation(s) previewed for ${mutateBasename}: ${opList}. No changes written.`
                : `Applied ${mutations.length} mutation(s) to ${mutateBasename}: ${opList}.`;

            // ACX.3: Pre-flight enrichment — prepend target node context
            const mutateResult: { content: Array<{ type: string; text: string }> } = {
                content: [
                    {
                        type: "text",
                        text: mutateSummary,
                    },
                    {
                        type: "text",
                        text: formatMutationReceipt(targetPath, mutations, batchId, effectiveWriteFile),
                    },
                ],
            };

            try {
                const enrichCtx = await assembleSessionContext(projectRoot);
                const enrichment = enrichToolCall("bridge_ast_mutate", request.params.arguments as Record<string, unknown>, enrichCtx);
                if (enrichment) {
                    mutateResult.content.unshift({ type: "text", text: enrichment.contextPreamble });
                }
            } catch {
                // Enrichment is best-effort — never block the mutation result
            }

            // V.2-mp: Record provenance for each mutation in this batch (skipped in dry-run mode).
            if (!dryRunMutate) {
                try {
                    const provSvc = getProvenanceService(projectRoot);
                    const args = request.params.arguments as Record<string, unknown>;
                    const sessionId = typeof args.sessionId === "string" ? args.sessionId : null;
                    const agentId = typeof args.agentId === "string" ? args.agentId : "bridge_ast_mutate";
                    const reasoning = typeof args.reasoning === "string" ? args.reasoning : null;
                    const confidence = typeof args.confidence === "number" ? args.confidence : null;
                    provSvc.recordProvenanceBatch(
                        mutations.map((_, idx) => ({
                            mutationId: `${batchId}-${idx}`,
                            source: "agent" as ProvenanceSource,
                            agentId,
                            sessionId,
                            reasoning,
                            confidence,
                        })),
                    );
                } catch {
                    // Provenance recording is best-effort — never block mutation result
                }
            }

            // V.1-rs: Compute MRS for each mutation in the batch (skipped in dry-run mode).
            if (!dryRunMutate) {
                try {
                    const mutationArgs = request.params.arguments as Record<string, unknown>;
                    const riskScores = mutations.map((mutationOp) => {
                        const opType: string =
                            (mutationOp as Record<string, unknown>).type as string ??
                            (mutationOp as Record<string, unknown>).kind as string ??
                            'unknown';
                        return mrsScoremutation({
                            opType,
                            affectedNodeCount: 1,
                            filePath: typeof mutationArgs.targetPath === "string" ? mutationArgs.targetPath : undefined,
                            projectRoot,
                        });
                    });

                    // Summarise: highest-tier score wins for the batch
                    const batchScore = riskScores.reduce(
                        (max, s) => (s.score > max.score ? s : max),
                        riskScores[0] ?? { score: 0, tier: 'green' as const, factors: [], recommendation: '' }
                    );

                    mutateResult.content.push({
                        type: "text",
                        text: JSON.stringify({
                            riskScore: {
                                batchHighScore: batchScore.score,
                                batchTier: batchScore.tier,
                                recommendation: batchScore.recommendation,
                                perMutation: riskScores.map((s, i) => ({
                                    index: i,
                                    opType: (mutations[i] as Record<string, unknown>).type ?? 'unknown',
                                    score: s.score,
                                    tier: s.tier,
                                })),
                            }
                        }, null, 2),
                    });
                } catch {
                    // MRS is best-effort — never block the mutation result
                }
            }

            // GOV.3: Session-Level Mutation Validation — run after all mutations are applied.
            // Errors are informational: they are appended to the response so the agent
            // can self-correct, but they never block the return value.
            try {
                // Re-parse the final code so the validator sees a clean AST.
                const validationAst = parse(newCode, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                });
                const sessionMuts: SessionMutation[] = mutations.map((m) => ({
                    nodeId: typeof (m as any).args?.nodeId === "string"
                        ? (m as any).args.nodeId as string
                        : typeof (m as any).args?.sourceId === "string"
                        ? (m as any).args.sourceId as string
                        : undefined,
                    type: typeof (m as any).type === "string" ? (m as any).type as string : undefined,
                }));
                const sessionValidation = validateSessionState(
                    validationAst as any,
                    targetPath,
                    sessionMuts,
                );
                mutateResult.content.push({
                    type: "text",
                    text: JSON.stringify({ sessionValidation }, null, 2),
                });
            } catch {
                // Session validation is best-effort — never block the mutation result
            }

            // CX.1: Append project_context footer (best-effort, never blocks mutation result)
            try {
                const mutateProjectCtx = loadProjectContext(projectRoot);
                if (mutateProjectCtx !== null) {
                    mutateResult.content.push({
                        type: "text",
                        text: JSON.stringify({ project_context: mutateProjectCtx }, null, 2),
                    });
                }
            } catch {
                // project_context is best-effort — never block the mutation result
            }

            return mutateResult;
        }


        case "read_design_intent": {
            const { projectRoot } = request.params.arguments as { projectRoot: string };

            if (!projectRoot || !fs.existsSync(projectRoot)) {
                throw new Error(`Project root not found or not specified: ${projectRoot}`);
            }

            const intentPath = path.join(projectRoot, '.bridge', 'current-intent.json');

            if (!fs.existsSync(intentPath)) {
                return {
                    content: [{
                        type: "text",
                        text: "No design intent found. Push a component or page from the Figma plugin first.",
                    }],
                };
            }

            try {
                const intent = JSON.parse(fs.readFileSync(intentPath, 'utf-8')) as BridgeSDIPayload;
                const plan = intent.type === 'page'
                    ? buildComposerPlan(intent)
                    : buildAtomicSyncPlan(intent);
                return { content: [{ type: "text", text: plan }] };
            } catch (err: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Failed to read intent file: ${err.message}` }],
                };
            }
        }

        case "bridge_query_registry": {
            const { semantic_query, limit = 3, projectRoot } = request.params.arguments as {
                semantic_query: string;
                limit?: number;
                projectRoot: string;
            };

            if (!fs.existsSync(projectRoot)) {
                throw new Error(`Project root not found: ${projectRoot}`);
            }

            // Hydrate the RAG cache with the local manifest so freshly-opened
            // projects are searchable without a prior bridge_add_remote_library call.
            {
                const localManifestPath = path.join(projectRoot, "bridge-manifest.json");
                if (fs.existsSync(localManifestPath)) {
                    try {
                        const raw = JSON.parse(fs.readFileSync(localManifestPath, "utf-8"));
                        const localComponents = raw.components ?? {};
                        if (Object.keys(localComponents).length > 0) {
                            hydrateRAGCache(localComponents);
                        }
                    } catch {
                        // Non-fatal — proceed with existing cache contents
                    }
                }
            }

            // Primary: RAG search (standalone vector search)
            let matches: any[] = [];
            try {
                matches = await queryRAGRegistry(semantic_query, limit);
            } catch (err) {
                console.error("[Bridge Registry] RAG search failed, falling back to manifest relevance", err);

                const manifestPath = path.join(projectRoot, "bridge-manifest.json");
                let components: Record<string, any> = {};

                if (fs.existsSync(manifestPath)) {
                    try {
                        const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                        components = raw.components ?? {};
                    } catch (err: any) {
                        console.error("Failed to parse manifest for fallback", err);
                    }
                }
                matches = queryRegistry(components, semantic_query, Math.max(1, Math.min(limit, 10)));
            }

            const artifact = formatShadowStorybook(matches, semantic_query);
            return { content: [{ type: "text", text: artifact }] };
        }


        case "bridge_audit": {
            const auditArgs = request.params.arguments as {
                source: string;
                filePath: string;
                filePaths?: string[];
                ruleIds?: string[];
                severity?: "info" | "warning" | "critical";
                healOnAudit?: boolean;
            };
            if (auditArgs.filePaths && auditArgs.filePaths.length > 0) {
                const batchResult = await handleBridgeAuditBatch(
                    auditArgs.filePaths,
                    { ruleIds: auditArgs.ruleIds, severity: auditArgs.severity },
                    bridgeConfig,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(batchResult, null, 2) }],
                };
            }
            const auditResult = await handleBridgeAudit(auditArgs, bridgeConfig);
            const auditResultText = JSON.stringify(auditResult, null, 2);
            // ACX.3: Append token context to audit results
            let enrichedAuditText = auditResultText;
            try {
                enrichedAuditText = enrichToolResult(
                    "bridge_audit",
                    request.params.arguments as Record<string, unknown>,
                    auditResultText,
                    bridgeConfig.projectRoot,
                );
            } catch {
                // Enrichment is best-effort — never block the audit result
            }

            // GOV.2: Record override telemetry when audit runs with disabled rules.
            // Fire-and-forget — never blocks the audit response.
            try {
                const disabledRules = bridgeConfig.policy.a11y.disabled_rules;
                const mithrilOff = bridgeConfig.policy.mithril.mode === "off";
                if ((disabledRules.length > 0 || mithrilOff) && auditArgs.filePath) {
                    const ovrSvc = getOverrideTelemetryService(bridgeConfig.projectRoot);
                    for (const ruleId of disabledRules) {
                        ovrSvc.recordOverride({
                            id: crypto.randomUUID(),
                            nodeId: null,
                            ruleId,
                            sessionId: null,
                            agentId: "bridge_audit",
                            timestamp: new Date().toISOString(),
                            projectRoot: bridgeConfig.projectRoot,
                            reason: `Rule ${ruleId} skipped during audit of ${path.basename(auditArgs.filePath)}`,
                        });
                    }
                    if (mithrilOff) {
                        ovrSvc.recordOverride({
                            id: crypto.randomUUID(),
                            nodeId: null,
                            ruleId: "MITHRIL-ALL",
                            sessionId: null,
                            agentId: "bridge_audit",
                            timestamp: new Date().toISOString(),
                            projectRoot: bridgeConfig.projectRoot,
                            reason: `Mithril linting disabled during audit of ${path.basename(auditArgs.filePath)}`,
                        });
                    }
                }
            } catch {
                // Override telemetry is best-effort — never block audit result
            }

            return {
                content: [{ type: "text", text: enrichedAuditText }],
            };
        }

        case "bridge_fix": {
            const fixArgs = request.params.arguments as {
                source: string;
                filePath: string;
                violationIds?: string[];
                dryRun?: boolean;
            };
            const fixResult = await handleBridgeFix(fixArgs, bridgeConfig);
            const fixResultText = JSON.stringify(fixResult, null, 2);
            // ACX.3: Prepend node context preamble to fix results
            let enrichedFixText = fixResultText;
            try {
                enrichedFixText = enrichToolResult(
                    "bridge_fix",
                    request.params.arguments as Record<string, unknown>,
                    fixResultText,
                    bridgeConfig.projectRoot,
                );
            } catch {
                // Enrichment is best-effort — never block the fix result
            }

            // V.2-mp: Record provenance when bridge_fix actually applied fixes.
            if (fixResult.fixesApplied > 0 && !fixArgs.dryRun) {
                try {
                    const fixProjectRoot = findProjectRoot(fixArgs.filePath) ?? bridgeConfig.projectRoot;
                    const provSvc = getProvenanceService(fixProjectRoot);
                    const fixMutationId = crypto.randomUUID();
                    provSvc.recordProvenance(
                        fixMutationId,
                        "auto-fix",
                        "bridge_fix",
                        null,
                        `bridge_fix applied ${fixResult.fixesApplied} token fix(es) to ${path.basename(fixArgs.filePath)}`,
                        null,
                    );
                } catch {
                    // Provenance recording is best-effort — never block fix result
                }
            }

            // GOV.2: Record override telemetry when bridge_fix applies token corrections.
            // Each fix represents an override of the design system that was corrected.
            // Fire-and-forget — never blocks the fix response.
            if (fixResult.fixesApplied > 0) {
                try {
                    const fixProjectRoot = findProjectRoot(fixArgs.filePath) ?? bridgeConfig.projectRoot;
                    const ovrSvc = getOverrideTelemetryService(fixProjectRoot);
                    ovrSvc.recordOverride({
                        id: crypto.randomUUID(),
                        nodeId: null,
                        ruleId: "MITHRIL-TOKEN-DRIFT",
                        sessionId: null,
                        agentId: "bridge_fix",
                        timestamp: new Date().toISOString(),
                        projectRoot: fixProjectRoot,
                        reason: `${fixResult.fixesApplied} token override(s) corrected in ${path.basename(fixArgs.filePath)}${fixArgs.dryRun ? " (dry run)" : ""}`,
                    });
                } catch {
                    // Override telemetry is best-effort — never block fix result
                }
            }

            return {
                content: [{ type: "text", text: enrichedFixText }],
            };
        }

        case "bridge_swarm_audit_fix": {
            const swarmArgs = request.params.arguments as {
                glob: string;
                autoFix?: boolean;
                dryRun?: boolean;
                projectRoot: string;
            };
            const swarmResult = await handleBridgeSwarmAuditFix(swarmArgs, bridgeConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(swarmResult, null, 2) }],
            };
        }

        case "bridge_ingest_figma": {
            const ingestArgs = request.params.arguments as {
                figmaPayload: string;
                figmaUrl?: string;
                outputFormat?: "jsx" | "tsx" | "vue";
                componentName?: string;
            };
            const result = await handleBridgeIngest(ingestArgs, bridgeConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        case "bridge_sync_tokens": {
            const syncArgs = request.params.arguments as {
                direction: "figma-to-local" | "diff-only";
                localTokensPath?: string;
                incomingTokens?: string;
            };
            const result = await handleBridgeSync(syncArgs, bridgeConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        case "bridge_audit_report": {
            const auditReportArgs = request.params.arguments as {
                source: string;
                filePath: string;
                format?: "json" | "sarif";
                tokens?: unknown[];
                sourceAuthority?: string;
            };
            const result = handleAuditReport({
                source: auditReportArgs.source,
                filePath: auditReportArgs.filePath,
                format: auditReportArgs.format,
                tokens: auditReportArgs.tokens as any,
                sourceAuthority: auditReportArgs.sourceAuthority,
            });
            return result;
        }

        case "bridge_debt_report": {
            const { glob: globPattern, format = "json", track = false } = request.params.arguments as {
                glob?: string;
                format?: "json" | "markdown";
                track?: boolean;
            };

            const projectRoot = process.cwd();
            const report = generateDebtReport({
                projectRoot,
                glob: globPattern,
                track,
            });

            const text = format === "markdown"
                ? formatReportAsMarkdown(report)
                : JSON.stringify(report, null, 2);

            // CX.1: Build summary for bridge_debt_report
            let debtSummary =
                `Project health: ${report.healthScore}/100 (Grade ${report.grade}). ` +
                `${report.totalViolations} violation(s) across ${report.scannedFiles} files.`;
            if (track) {
                debtSummary += " Snapshot saved to debt history.";
            }

            return {
                content: [
                    { type: "text", text: debtSummary },
                    { type: "text", text },
                ],
            };
        }

        case "bridge_set_policy": {
            const { action, policy: policyUpdate } = request.params.arguments as {
                action: "read" | "update" | "reset";
                policy?: Partial<BridgePolicy>;
            };

            const projectRoot = process.cwd();

            switch (action) {
                case "read": {
                    const current = readPolicy(projectRoot);
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(current, null, 2),
                        }],
                    };
                }

                case "update": {
                    if (!policyUpdate || typeof policyUpdate !== "object") {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_set_policy: 'update' action requires a 'policy' object with partial policy fields.",
                            }],
                        };
                    }
                    const merged = mergePolicy(projectRoot, policyUpdate);
                    // Reload into active config so subsequent audits use new thresholds
                    bridgeConfig = loadConfig(projectRoot);

                    // GOV.2: Record override telemetry for disabled rules in policy update.
                    // Fire-and-forget — never blocks the policy update response.
                    try {
                        const ovrSvc = getOverrideTelemetryService(projectRoot);
                        const disabledA11yRules = (policyUpdate as Record<string, unknown>).a11y &&
                            typeof (policyUpdate as Record<string, unknown>).a11y === "object" &&
                            Array.isArray(((policyUpdate as Record<string, unknown>).a11y as Record<string, unknown>).disabled_rules)
                            ? ((policyUpdate as Record<string, unknown>).a11y as Record<string, unknown>).disabled_rules as string[]
                            : [];
                        for (const ruleId of disabledA11yRules) {
                            ovrSvc.recordOverride({
                                id: crypto.randomUUID(),
                                nodeId: null,
                                ruleId,
                                sessionId: null,
                                agentId: "bridge_set_policy",
                                timestamp: new Date().toISOString(),
                                projectRoot,
                                reason: `Rule ${ruleId} disabled via policy update`,
                            });
                        }
                        // Track Mithril mode changes as overrides
                        const mithrilUpdate = (policyUpdate as Record<string, unknown>).mithril;
                        if (mithrilUpdate && typeof mithrilUpdate === "object" && "mode" in (mithrilUpdate as Record<string, unknown>)) {
                            const mode = (mithrilUpdate as Record<string, string>).mode;
                            if (mode === "off" || mode === "advisory") {
                                ovrSvc.recordOverride({
                                    id: crypto.randomUUID(),
                                    nodeId: null,
                                    ruleId: "MITHRIL-ALL",
                                    sessionId: null,
                                    agentId: "bridge_set_policy",
                                    timestamp: new Date().toISOString(),
                                    projectRoot,
                                    reason: `Mithril mode changed to '${mode}' via policy update`,
                                });
                            }
                        }
                    } catch {
                        // Override telemetry is best-effort — never block policy update
                    }

                    return {
                        content: [{
                            type: "text",
                            text: `Policy updated successfully.\n\n${JSON.stringify(merged, null, 2)}`,
                        }],
                    };
                }

                case "reset": {
                    const defaults = getDefaultPolicy();
                    writePolicy(projectRoot, defaults);
                    bridgeConfig = loadConfig(projectRoot);
                    return {
                        content: [{
                            type: "text",
                            text: `Policy reset to defaults.\n\n${JSON.stringify(defaults, null, 2)}`,
                        }],
                    };
                }

                default:
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `bridge_set_policy: unknown action '${action}'. Must be 'read', 'update', or 'reset'.`,
                        }],
                    };
            }
        }

        case "bridge_accessibility_report": {
            const a11yArgs = request.params.arguments as {
                source?: string;
                filePath?: string;
                criteria?: string[];
                categories?: import("./core/a11y/types.js").A11yRuleCategory[];
                autoFix?: boolean;
                includePassingRules?: boolean;
            };
            const a11yResult = await handleAccessibilityReport(a11yArgs);
            return {
                content: [{ type: "text", text: JSON.stringify(a11yResult, null, 2) }],
            };
        }

        case "bridge_generate_dbom": {
            const dbomArgs = request.params.arguments as {
                projectRoot?: string;
                format?: "json" | "markdown";
            };
            return handleGenerateDBOM(dbomArgs, process.cwd());
        }

        case "bridge_add_remote_library": {
            const remoteArgs = request.params.arguments as {
                githubUrl: string;
                branch?: string;
                manifestPath?: string;
                alias?: string;
                projectRoot: string;
            };
            const remoteResult = await handleBridgeAddRemoteLibrary(remoteArgs);
            return {
                content: [{ type: "text", text: JSON.stringify(remoteResult, null, 2) }],
            };
        }

        case "bridge_plan": {
            const planResult = handleBridgePlan(
                args as unknown as BridgePlanParams,
                bridgeConfig,
            );
            return planResult;
        }

        case "bridge_mutation_provenance": {
            const provArgs = request.params.arguments as {
                action: "summary" | "audit_trail" | "by_source";
                projectRoot: string;
                filePath?: string;
                source?: ProvenanceSource;
                startDate?: string;
                endDate?: string;
                limit?: number;
            };

            if (!provArgs.projectRoot || !fs.existsSync(provArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "bridge_mutation_provenance: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const provSvc = getProvenanceService(provArgs.projectRoot);

            switch (provArgs.action) {
                case "summary": {
                    const summary = provSvc.getProvenanceSummary();
                    return {
                        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
                    };
                }

                case "audit_trail": {
                    if (!provArgs.filePath) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_mutation_provenance: action='audit_trail' requires 'filePath'.",
                            }],
                        };
                    }
                    const trail = provSvc.getAuditTrail(
                        provArgs.filePath,
                        provArgs.startDate,
                        provArgs.endDate,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(trail, null, 2) }],
                    };
                }

                case "by_source": {
                    if (!provArgs.source) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_mutation_provenance: action='by_source' requires 'source'.",
                            }],
                        };
                    }
                    const records = provSvc.getProvenanceBySource(
                        provArgs.source,
                        provArgs.limit ?? 100,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(records, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `bridge_mutation_provenance: unknown action '${(provArgs as { action: string }).action}'. Must be 'summary', 'audit_trail', or 'by_source'.`,
                        }],
                    };
                }
            }
        }

        case "bridge_agent_risk": {
            const arArgs = request.params.arguments as {
                action: "summary" | "by_agent";
                projectRoot: string;
                agentId?: string;
                periodDays?: number;
            };

            if (!arArgs.projectRoot || !fs.existsSync(arArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "bridge_agent_risk: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const arSvc = getAgentRiskService(arArgs.projectRoot);

            switch (arArgs.action) {
                case "summary": {
                    const summary = arSvc.getAgentRiskSummary(arArgs.projectRoot, arArgs.periodDays ?? 7);
                    return {
                        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
                    };
                }

                case "by_agent": {
                    if (!arArgs.agentId) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_agent_risk: action='by_agent' requires 'agentId'.",
                            }],
                        };
                    }
                    const profile = arSvc.getAgentProfile(arArgs.agentId, arArgs.projectRoot, arArgs.periodDays ?? 7);
                    if (!profile) {
                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({ agentId: arArgs.agentId, found: false, message: "No mutations recorded for this agent in the specified period." }, null, 2),
                            }],
                        };
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `bridge_agent_risk: unknown action '${(arArgs as { action: string }).action}'. Must be 'summary' or 'by_agent'.`,
                        }],
                    };
                }
            }
        }

        case "bridge_override_telemetry": {
            const ovrArgs = request.params.arguments as {
                action: "summary" | "by_session" | "by_rule";
                projectRoot: string;
                sessionId?: string;
                ruleId?: string;
                limit?: number;
            };

            if (!ovrArgs.projectRoot || !fs.existsSync(ovrArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "bridge_override_telemetry: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const ovrSvc = getOverrideTelemetryService(ovrArgs.projectRoot);

            switch (ovrArgs.action) {
                case "summary": {
                    const summary = ovrSvc.getOverrideSummary(ovrArgs.projectRoot);
                    return {
                        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
                    };
                }

                case "by_session": {
                    if (!ovrArgs.sessionId) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_override_telemetry: action='by_session' requires 'sessionId'.",
                            }],
                        };
                    }
                    const sessionOverrides = ovrSvc.getOverridesBySession(
                        ovrArgs.sessionId,
                        ovrArgs.limit ?? 100,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(sessionOverrides, null, 2) }],
                    };
                }

                case "by_rule": {
                    if (!ovrArgs.ruleId) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "bridge_override_telemetry: action='by_rule' requires 'ruleId'.",
                            }],
                        };
                    }
                    const ruleOverrides = ovrSvc.getOverridesByRule(
                        ovrArgs.ruleId,
                        ovrArgs.limit ?? 100,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(ruleOverrides, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `bridge_override_telemetry: unknown action '${(ovrArgs as { action: string }).action}'. Must be 'summary', 'by_session', or 'by_rule'.`,
                        }],
                    };
                }
            }
        }

        case "bridge_anomaly_report": {
            const anomArgs = request.params.arguments as {
                action: "detect" | "history" | "baseline";
                projectRoot: string;
                windowDays?: number;
                limit?: number;
            };

            if (!anomArgs.projectRoot || !fs.existsSync(anomArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "bridge_anomaly_report: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const anomSvc = getAnomalyDetectionService(anomArgs.projectRoot);

            switch (anomArgs.action) {
                case "baseline": {
                    const baseline = anomSvc.computeBaseline(
                        anomArgs.projectRoot,
                        anomArgs.windowDays ?? 30,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(baseline, null, 2) }],
                    };
                }

                case "detect": {
                    const baseline = anomSvc.computeBaseline(
                        anomArgs.projectRoot,
                        anomArgs.windowDays ?? 30,
                    );
                    const anomalies = anomSvc.detectAnomalies(anomArgs.projectRoot, baseline);
                    return {
                        content: [{ type: "text", text: JSON.stringify({ baseline, anomalies }, null, 2) }],
                    };
                }

                case "history": {
                    const history = anomSvc.getAnomalyHistory(
                        anomArgs.projectRoot,
                        anomArgs.limit ?? 50,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `bridge_anomaly_report: unknown action '${(anomArgs as { action: string }).action}'. Must be 'detect', 'history', or 'baseline'.`,
                        }],
                    };
                }
            }
        }

        default:
            throw new Error(`Unknown tool: ${request.params.name}`);
    }
});

function buildAtomicSyncPlan(intent: BridgeSDIPayload): string {
    const { name, sourceId, appliedTokens, layoutState } = intent;

    const tokenRows = Object.entries(appliedTokens)
        .flatMap(([key, val]) => {
            if (key === 'spacing' && val && typeof val === 'object') {
                return Object.entries(val as Record<string, string>).map(
                    ([prop, token]) => `| ${prop} | ${token} |`
                );
            }
            return [`| ${key} | ${val} |`];
        })
        .join('\n');

    const layoutRows = Object.entries(layoutState)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join('\n');

    const mutations: string[] = [];
    if (appliedTokens.backgroundColor) {
        mutations.push(`- \`applyTokenFix\` — replace hardcoded background with \`${appliedTokens.backgroundColor}\``);
    }
    if (appliedTokens.typography) {
        mutations.push(`- \`addClassName\` — add typography token class \`${appliedTokens.typography}\``);
    }
    if (appliedTokens.spacing) {
        for (const [prop, token] of Object.entries(appliedTokens.spacing)) {
            mutations.push(`- \`applyTokenFix\` — replace hardcoded \`${prop}\` with token \`${token}\``);
        }
    }
    mutations.push(`- \`updateProp\` — set \`display\` → \`${layoutState.display}\``);
    if (layoutState.direction) mutations.push(`- \`updateProp\` — set \`flex-direction\` → \`${layoutState.direction}\``);
    if (layoutState.gap) mutations.push(`- \`updateProp\` — set \`gap\` → \`${layoutState.gap}\``);
    if (layoutState.alignItems) mutations.push(`- \`updateProp\` — set \`alignItems\` → \`${layoutState.alignItems}\``);
    if (layoutState.justifyContent) mutations.push(`- \`updateProp\` — set \`justifyContent\` → \`${layoutState.justifyContent}\``);

    return `## Bridge Execution Plan — Atomic Sync

**Component:** ${name} (Figma Node: ${sourceId})

**Strategy:** Locate the existing component by data-bridge-id or file name. Run MithrilLinter on applied tokens to detect drift. Apply token fixes and prop updates via ASTService.

### Applied Tokens

| Token | Value |
|-------|-------|
${tokenRows}

### Layout State

| Property | Value |
|----------|-------|
${layoutRows}

### Recommended Mutations (via apply_ast_mutations)

${mutations.join('\n')}

### Next Step

Call \`apply_ast_mutations\` with the mutations above on the target component file.`;
}

function buildComposerPlan(intent: BridgeSDIPayload): string {
    const { name, sourceId, layoutState, children = [] } = intent;

    const layoutRows = Object.entries(layoutState)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join('\n');

    const renderChild = (child: BridgeSDIPayload, depth: number): string => {
        const indent = '  '.repeat(depth);
        const tokenSummary = Object.entries(child.appliedTokens)
            .flatMap(([k, v]) => {
                if (k === 'spacing' && v && typeof v === 'object') {
                    return Object.entries(v as Record<string, string>).map(([p, t]) => `${p}: ${t}`);
                }
                return [`${k}: ${v}`];
            })
            .join(', ');
        let line = `${indent}- ${child.name} (sourceId: ${child.sourceId}, type: ${child.type}) — display: ${child.layoutState.display}`;
        if (tokenSummary) line += ` — tokens: ${tokenSummary}`;
        const nestedLines: string[] = [line];
        if (depth < 1 && child.children && child.children.length > 0) {
            for (const grandchild of child.children) {
                nestedLines.push(renderChild(grandchild, depth + 1));
            }
        }
        return nestedLines.join('\n');
    };

    const treeLines = children.map(c => renderChild(c, 0)).join('\n');

    const injectOps = children.map(child => {
        const componentName = child.name.replace(/\s+/g, '');
        return `- \`injectComponent\` — targetNodeId: <root>, jsxSnippet: \`<${componentName} />\``;
    }).join('\n');

    return `## Bridge Execution Plan — Page Composer

**Page:** ${name} (Figma Node: ${sourceId})

**Strategy:** Match each child node to existing components in bridge-registry.db. Use injectComponent mutations to assemble the structural tree from the root outward.

### Page Layout

| Property | Value |
|----------|-------|
${layoutRows}

### Component Tree

${treeLines || '(no children)'}

### Recommended Assembly Mutations (via apply_ast_mutations)

${injectOps || '(no top-level children to inject)'}

### Next Step

1. Query bridge-registry.db for each component name to find its file path.
2. Call \`apply_ast_mutations\` with \`injectComponent\` ops to build the page structure.`;
}

function findProjectRoot(startPath: string): string | null {
    let curr = path.dirname(startPath);
    while (curr !== path.parse(curr).root) {
        if (fs.existsSync(path.join(curr, ".bridge"))) {
            return curr;
        }
        curr = path.dirname(curr);
    }
    return null;
}

/**
 * Listen for ingestion updates and notify MCP clients that resources have changed.
 */
bridgeEvents.on(EVENTS.TOKENS_UPDATED, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

bridgeEvents.on(EVENTS.INTENT_UPDATED, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

// Phase ACX.2 — context delta push triggers a resource-list change notification
// so polling MCP clients know to re-fetch bridge://session-context.
bridgeEvents.on(EVENTS.CONTEXT_DELTA, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

/**
 * Start the server.
 *
 * Project root resolution priority:
 *   1. --project-root <path> CLI argument
 *   2. BRIDGE_PROJECT_ROOT environment variable
 *   3. process.cwd() fallback
 */
export async function runServer() {
    const projectRoot = resolveProjectRoot();
    bridgeConfig = loadConfig(projectRoot);

    console.error(`[Bridge] Project root: ${projectRoot}`);
    console.error(`[Bridge] Active domains: ${bridgeConfig.domains.join(", ")}`);

    // Phase ACX.2 — start the event-driven context push manager.
    contextPushManager.start(projectRoot);
    console.error("[Bridge] ContextPushManager started");

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Bridge MCP Server listening on stdio");

    // Clean up on graceful shutdown.
    const shutdown = () => {
        contextPushManager.stop();
        process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
