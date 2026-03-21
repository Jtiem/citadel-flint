import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BRAND, toolName, resourceUri, configPath, logTag } from './brand.js';
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
import { moveNode, injectComponent, applyTokenFix, assembleLayout, deleteNode, updateProp, updateClassName, updateTextContent, wrapNode, emitImport, emitHook, emitHandler, emitCallback, emitConditional, emitMap, composeSlot } from "./core/ast-modifier.js";
import { TelemetryLogger } from "./core/telemetry.js";
import { formatMutationReceipt, formatAuditReport } from "./core/formatters.js";
import { queryRegistry, formatShadowStorybook } from "./core/registryService.js";
import { queryRAGRegistry } from "./core/ragRegistryService.js";
import type { DesignToken, LinterWarning, FlintSDIPayload } from "./types.js";
import { flintEvents, EVENTS } from "./core/events.js";
import { resolveProjectRoot, loadConfig } from "./core/config-loader.js";
import { DEFAULT_CONFIG } from "./core/config.js";
import type { FlintConfig, FlintPolicy } from "./core/config.js";
import { readPolicy, writePolicy, mergePolicy, getDefaultPolicy } from "./core/policyLoader.js";
import { handleFlintAudit, handleFlintAuditBatch, FLINT_AUDIT_TOOL } from "./tools/audit.js";
import { handleFlintFix, FLINT_FIX_TOOL } from "./tools/fix.js";
import { handleFlintSwarmAuditFix, FLINT_SWARM_AUDIT_FIX_TOOL } from "./tools/swarm.js";
import { handleFlintIngest, FLINT_INGEST_TOOL } from "./tools/ingest.js";
import { handleFlintSync, FLINT_SYNC_TOOL } from "./tools/sync.js";
import { handleAuditReport, FLINT_AUDIT_REPORT_TOOL } from "./tools/auditReport.js";
import { FLINT_SENTINEL_PROMPT_DEF, getFlintSentinelContent } from "./prompts/sentinel.js";
import { CAPABILITIES_RESOURCE, readCapabilities } from "./core/capabilities/index.js";
import { WORKFLOW_GUIDE_PROMPT, getWorkflowGuideContent } from "./prompts/workflow-guide.js";
import { domainRegistry } from "./domains/index.js";
import { loadRulesFromDirectory } from "./core/rules/loader.js";
import { generateDebtReport, generateDashboard, formatReportAsMarkdown } from "./core/dashboard/debtReportService.js";
import { handleAccessibilityReport, FLINT_ACCESSIBILITY_REPORT_TOOL } from "./tools/accessibility.js";
import { handleGenerateDBOM, FLINT_GENERATE_DBOM_TOOL, getCachedDBOM } from "./tools/dbom.js";
import { formatDBOMAsMarkdown } from "./core/dbom/formatter.js";
import { handleFlintAddRemoteLibrary, FLINT_ADD_REMOTE_LIBRARY_TOOL } from "./tools/remoteLibrary.js";
import { setRegistryCache as hydrateRAGCache } from "./core/ragRegistryService.js";
import { contextPushManager } from "./core/contextPush.js";
import { assembleSessionContext } from "./core/sessionContext.js";
import type { SessionContext } from "./core/sessionContext.js";
import { assessComplexity } from "./core/complexityRouter.js";
import { enrichToolCall, enrichToolResult } from "./core/toolEnricher.js";
import BetterSqlite3 from "better-sqlite3";
import { MutationProvenanceService } from "./core/governance/mutationProvenanceService.js";
import { OverrideTelemetryService } from "./core/governance/overrideTelemetryService.js";
import type { ProvenanceSource, OverrideEvent } from "./core/governance/types.js";
import { scoreMutation as mrsScoremutation, RiskScoringService } from "./core/governance/riskScoringService.js";
import { validateSessionState } from "./core/governance/sessionValidator.js";
import type { SessionMutation } from "./core/governance/sessionValidator.js";
import { handleFlintPlan, FLINT_PLAN_TOOL } from "./tools/plan.js";
import type { FlintPlanParams } from "./tools/plan.js";
import { loadProjectContext } from "./core/projectContext.js";
import { AgentRiskService } from "./core/governance/agentRiskService.js";
import { TrustTierService } from "./core/governance/trustTierService.js";
import type { TrustTier } from "./core/governance/trustTierService.js";
import { AnomalyDetectionService } from "./core/governance/anomalyDetectionService.js";
import type { AgentRiskSummary } from "./core/governance/types.js";
import { migrateFile } from "./core/tailwindMigrator.js";
import type { MigrateResult } from "./core/tailwindMigrator.js";
import { computeTokenDiff, migrateFiles as migrateDesignSystemFiles, generateMigrationReport } from "./core/designSystemMigration.js";
import { validateThemes } from "./core/themeValidationService.js";
import { startResponseTimer, withResponseMeta } from "./core/responseMeta.js";
import { SyncSchema } from "./core/sync/syncSchema.js";
import { ConnectionService } from "./core/sync/connectionService.js";
import { TokenSyncEngine } from "./core/sync/tokenSyncEngine.js";
import { FigmaApiService } from "./core/sync/figmaApiService.js";
import { SyncCheckService } from "./core/sync/syncCheckService.js";
import { OfflineQueue } from "./core/sync/offlineQueue.js";
import { SyncHistoryService } from "./core/sync/syncHistoryService.js";
import { handleUniversalAudit, FLINT_UNIVERSAL_AUDIT_TOOL } from "./tools/universalAudit.js";
import { elicitRemediation } from "./core/elicitRemediation.js";
import {
    handleEnrichRegistry,
    handleApproveEnrichment,
    FLINT_ENRICH_REGISTRY_TOOL,
    FLINT_APPROVE_ENRICHMENT_TOOL,
} from "./tools/enrich.js";
import {
    handleReindexRegistry,
    FLINT_REINDEX_REGISTRY_TOOL,
} from "./tools/reindex.js";

// @ts-ignore
const generate = _generate.default || _generate;

// ---------------------------------------------------------------------------
// Provenance singleton — one MutationProvenanceService per project root,
// backed by a file-based SQLite database at <root>/.flint/provenance.db
// ---------------------------------------------------------------------------

const _provenanceServices = new Map<string, MutationProvenanceService>();

function getProvenanceService(projectRoot: string): MutationProvenanceService {
    const existing = _provenanceServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
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
// backed by a file-based SQLite database at <root>/.flint/overrides.db
// ---------------------------------------------------------------------------

const _overrideServices = new Map<string, OverrideTelemetryService>();

function getOverrideTelemetryService(projectRoot: string): OverrideTelemetryService {
    const existing = _overrideServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
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
    const dbDir = path.join(projectRoot, BRAND.configDir);
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
// Trust Tier singleton — AGV.4: one TrustTierService per project root,
// backed by a file-based SQLite database at <root>/.flint/provenance.db
// ---------------------------------------------------------------------------

const _trustTierServices = new Map<string, TrustTierService>();

function getTrustTierService(projectRoot: string): TrustTierService {
    const existing = _trustTierServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const provenanceDb = new BetterSqlite3(path.join(dbDir, "provenance.db"));
    const service = new TrustTierService(provenanceDb);
    _trustTierServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Anomaly Detection singleton — GOV.4: one AnomalyDetectionService per project root,
// backed by a file-based SQLite database at <root>/.flint/anomalies.db
// ---------------------------------------------------------------------------

const _anomalyServices = new Map<string, AnomalyDetectionService>();

function getAnomalyDetectionService(projectRoot: string): AnomalyDetectionService {
    const existing = _anomalyServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "anomalies.db"));
    const service = new AnomalyDetectionService(db);
    _anomalyServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Risk Scoring singleton — one RiskScoringService per project root,
// backed by the provenance.db (shares schema with MutationProvenanceService)
// ---------------------------------------------------------------------------

const _riskScoringServices = new Map<string, RiskScoringService>();

function getRiskScoringService(projectRoot: string): RiskScoringService {
    const existing = _riskScoringServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "provenance.db"));
    const service = new RiskScoringService(db);
    _riskScoringServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Figma Sync singleton — SYNC.1: one ConnectionService per project root,
// backed by a file-based SQLite database at <root>/.flint/sync.db
// ---------------------------------------------------------------------------

const _syncConnectionServices = new Map<string, ConnectionService>();

function getSyncConnectionService(projectRoot: string): ConnectionService {
    const existing = _syncConnectionServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "sync.db"));
    new SyncSchema(db); // initialize tables
    const service = new ConnectionService(db);
    _syncConnectionServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// SYNC.2 singleton — one TokenSyncEngine per project root
// ---------------------------------------------------------------------------

const _syncEngines = new Map<string, TokenSyncEngine>();

function getSyncEngine(projectRoot: string): TokenSyncEngine {
    const existing = _syncEngines.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "sync.db"));
    new SyncSchema(db);
    const engine = new TokenSyncEngine(db, new FigmaApiService());
    _syncEngines.set(projectRoot, engine);
    return engine;
}

// ---------------------------------------------------------------------------
// SYNC.4 singletons — SyncCheckService, OfflineQueue, SyncHistoryService
// Cached at module scope to avoid opening a new SQLite connection on every
// tool invocation.
// ---------------------------------------------------------------------------

const _syncCheckServices = new Map<string, SyncCheckService>();

function getSyncCheckService(projectRoot: string): SyncCheckService {
    const existing = _syncCheckServices.get(projectRoot);
    if (existing !== undefined) return existing;
    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const db = new BetterSqlite3(path.join(dbDir, "sync.db"));
    new SyncSchema(db);
    const service = new SyncCheckService(db);
    _syncCheckServices.set(projectRoot, service);
    return service;
}

const _offlineQueues = new Map<string, OfflineQueue>();

function getOfflineQueue(projectRoot: string): OfflineQueue {
    const existing = _offlineQueues.get(projectRoot);
    if (existing !== undefined) return existing;
    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const db = new BetterSqlite3(path.join(dbDir, "sync.db"));
    new SyncSchema(db);
    const service = new OfflineQueue(db);
    _offlineQueues.set(projectRoot, service);
    return service;
}

const _syncHistoryServices = new Map<string, SyncHistoryService>();

function getSyncHistoryService(projectRoot: string): SyncHistoryService {
    const existing = _syncHistoryServices.get(projectRoot);
    if (existing !== undefined) return existing;
    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const db = new BetterSqlite3(path.join(dbDir, "sync.db"));
    new SyncSchema(db);
    const service = new SyncHistoryService(db);
    _syncHistoryServices.set(projectRoot, service);
    return service;
}

/** Active project configuration — initialised in runServer() */
let flintConfig: FlintConfig = DEFAULT_CONFIG;

const server = new Server(
    {
        name: BRAND.productLower + "-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
        instructions:
            `${BRAND.product} is a governance engine that enforces design systems, accessibility, ` +
            "and brand compliance at the AST level. " +
            `New to ${BRAND.product}? Start with the ${BRAND.productLower}-workflow-guide prompt or read ` +
            `${resourceUri("capabilities")} for the full tool catalog. ` +
            `For project health at a glance, call ${toolName("get_context")} with your projectRoot.`,
    }
);

// REM.1: Advertise elicitation capability so clients know this server will issue
// elicitation requests. The MCP SDK's ServerCapabilities type does not yet include
// an elicitation key (it lives on ClientCapabilities), so we register it via
// registerCapabilities with an explicit cast.
server.registerCapabilities({ experimental: { elicitation: {} } } as any);

/**
 * List available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: toolName("status"),
                description: "Read the status of the " + BRAND.product + " MCP server.",
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
                        file: {
                            type: "string",
                            description: "Path to the .tsx or .jsx file to audit. Absolute or relative to cwd.",
                        },
                    },
                    required: ["file"],
                },
            },
            {
                name: "hydrate_figma_data",
                description: "Convert a Figma AST payload into component code snippets.",
                inputSchema: {
                    type: "object",
                    properties: {
                        figmaPayload: {
                            type: "string",
                            description: "JSON string of the Figma AST payload from the " + BRAND.product + " Figma plugin.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (where " + BRAND.manifestFile + " resides).",
                        },
                    },
                    required: ["figmaPayload", "projectRoot"],
                },
            },
            {
                name: "read_design_intent",
                description: "Reads the current design intent pushed from Figma (" + configPath('current-intent.json') + ") and returns a typed Execution Plan for the AI agent to implement.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .flint directory).",
                        },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("ast_mutate"),
                description: "Apply a batch of structural mutations to a file AST. Supported types: move, inject, fixToken, assembleLayout, updateProp, updateClassName, updateTextContent, delete, wrap, emitImport, emitHook, emitHandler, emitCallback, emitConditional, emitMap, composeSlot. This is the only approved way to modify code.",
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
                                        enum: ["move", "inject", "fixToken", "assembleLayout", "updateProp", "updateClassName", "updateTextContent", "delete", "wrap", "emitImport", "emitHook", "emitHandler", "emitCallback", "emitConditional", "emitMap", "composeSlot"],
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
                name: toolName("query_registry"),
                description: "Searches the " + BRAND.product + " UI component registry using both vector semantic search and text relevance. Returns a Shadow Storybook artifact with TypeScript interfaces and import paths.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "A natural language description of the UI element needed.",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum matches (default 3).",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (defaults to current working directory).",
                        },
                    },
                    required: ["query"],
                },
            },
            FLINT_AUDIT_TOOL,
            FLINT_FIX_TOOL,
            FLINT_SWARM_AUDIT_FIX_TOOL,
            FLINT_INGEST_TOOL,
            FLINT_SYNC_TOOL,
            FLINT_AUDIT_REPORT_TOOL,
            FLINT_ACCESSIBILITY_REPORT_TOOL,
            FLINT_GENERATE_DBOM_TOOL,
            FLINT_ADD_REMOTE_LIBRARY_TOOL,
            FLINT_PLAN_TOOL,
            {
                name: toolName("mutation_provenance"),
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
                            description: "Absolute path to the project root (must contain a .flint directory).",
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
                name: toolName("override_telemetry"),
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
                            description: "Absolute path to the project root (must contain a .flint directory).",
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
                name: toolName("agent_risk"),
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
                            description: "Absolute path to the project root (must contain a .flint directory).",
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
                name: toolName("anomaly_report"),
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
                            description: "Absolute path to the project root (must contain a .flint directory).",
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
                name: toolName("risk_score"),
                description: "Query the V.1-rs Mutation Risk Scoring engine. Supports three actions: 'score_mutation' — compute and persist a 5-factor weighted risk score (0-100) for a single mutation ID. 'file_profile' — aggregate risk profile for a file (mean/max score, trend). 'project_summary' — project-wide risk distribution, riskiest files, riskiest agents.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["score_mutation", "file_profile", "project_summary"],
                            description: "'score_mutation' — score a single mutation by ID. 'file_profile' — aggregate for a file. 'project_summary' — project-wide overview.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .flint directory).",
                        },
                        mutationId: {
                            type: "string",
                            description: "Required for action='score_mutation'. The mutation UUID from the ledger.",
                        },
                        filePath: {
                            type: "string",
                            description: "Required for action='file_profile'. Absolute path to the file.",
                        },
                        violationCount: {
                            type: "number",
                            description: "Optional for action='score_mutation'. Number of current violations on the node.",
                        },
                        hasCritical: {
                            type: "boolean",
                            description: "Optional for action='score_mutation'. Whether any violation is critical.",
                        },
                        wasAutoFixedFromCritical: {
                            type: "boolean",
                            description: "Optional for action='score_mutation'. Whether the node was auto-fixed from a critical violation.",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: toolName("debt_report"),
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
                            description: "If true, append a snapshot to " + configPath('debt-history.json') + " for trend tracking (default: false).",
                        },
                    },
                },
            },
            {
                name: toolName("set_policy"),
                description: "Read, update, or reset the project governance policy (" + configPath('policy.json') + "). Controls Mithril ΔE thresholds, A11y enforcement mode, export gate behaviour, and more.",
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
                name: toolName("get_context"),
                description: "Returns the full " + BRAND.product + " session context — active file, violations, tokens, mutations, health, and canvas state. Call this FIRST at the start of any session to eliminate cold-start round-trips.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .flint directory).",
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
                name: toolName("assess_complexity"),
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
            {
                name: toolName("migrate_tw"),
                description:
                    "EXP.3: Migrate Tailwind CSS v3 utility classes to their v4 equivalents using " +
                    "deterministic Babel AST traversal on JSX className attributes. " +
                    "Covers all officially deprecated v3 utilities: flex-grow→grow, flex-shrink→shrink, " +
                    "overflow-ellipsis→text-ellipsis, decoration-clone→box-decoration-clone, " +
                    "bg-gradient-to-*→bg-linear-to-*, opacity modifier sentinels (bg-opacity-X→bg-color/X), " +
                    "shadow-sm→shadow-xs, outline-none→outline-hidden, and more. " +
                    "After migration, automatically runs flint_audit on each changed file. " +
                    "Dry-run mode is the default — pass dryRun=false to write changes to disk.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePaths: {
                            type: "array",
                            items: { type: "string" },
                            description: "Absolute paths to the .tsx or .jsx files to migrate.",
                        },
                        dryRun: {
                            type: "boolean",
                            description:
                                "When true (default), report changes without writing to disk. " +
                                "Set false to apply migrations in-place.",
                        },
                        from: {
                            type: "string",
                            enum: ["3"],
                            description: "Source Tailwind version (currently only '3' is supported).",
                        },
                        to: {
                            type: "string",
                            enum: ["4"],
                            description: "Target Tailwind version (currently only '4' is supported).",
                        },
                    },
                    required: ["filePaths"],
                },
            },
            {
                name: toolName("agent_trust"),
                description: "AGV.4: Dynamic Agent Trust Tiers. Query and manage agent trust levels — agents earn/lose tiers based on behavioral history (red mutations, overrides, escalations). Actions: 'profile' (single agent), 'list' (all agents), 'promote' (manual upgrade), 'demote' (manual downgrade), 'reset' (return to restricted).",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["profile", "list", "promote", "demote", "reset"],
                            description: "'profile' — single agent trust record. 'list' — all agents. 'promote' — manual tier upgrade. 'demote' — reset to restricted. 'reset' — full reset.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .flint directory).",
                        },
                        agentId: {
                            type: "string",
                            description: "Required for 'profile', 'promote', 'demote', 'reset'. Agent ID.",
                        },
                        targetTier: {
                            type: "string",
                            enum: ["restricted", "standard", "elevated", "admin"],
                            description: "Required for 'promote'. Target trust tier.",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: toolName("figma_connect"),
                description: "SYNC.1: Manage Figma file connections for bidirectional token sync. Actions: 'connect' (store a new connection), 'disconnect' (deactivate), 'status' (query current connection state).",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            enum: ["connect", "disconnect", "status"],
                            description: "'connect' — store a new Figma file connection. 'disconnect' — deactivate the connection. 'status' — query current connection.",
                        },
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root.",
                        },
                        fileKey: {
                            type: "string",
                            description: "Required for 'connect'. The Figma file key.",
                        },
                        accessToken: {
                            type: "string",
                            description: "Required for 'connect'. Figma personal access token (will be stored encrypted).",
                        },
                        fileName: {
                            type: "string",
                            description: "Optional for 'connect'. Human-readable Figma file name.",
                        },
                    },
                    required: ["action", "projectRoot"],
                },
            },
            {
                name: toolName("sync_pull"),
                description: "SYNC.2: Pull remote Figma variable changes into local design-tokens.json. Auto-applies added/modified remote tokens. Creates pending conflicts for tokens changed in both.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("sync_push"),
                description: "SYNC.2: Push local design-token changes to the connected Figma file. Pushes added/modified local tokens.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("resolve_conflict"),
                description: "SYNC.2: Resolve a single pending token sync conflict by choosing 'local', 'remote', or 'merged' (with optional mergedValue).",
                inputSchema: {
                    type: "object",
                    properties: {
                        conflictId: { type: "string", description: "The pending conflict ID." },
                        resolution: { type: "string", enum: ["local", "remote", "merged"], description: "Which value wins." },
                        mergedValue: { type: "string", description: "Required when resolution is 'merged'. The merged token value." },
                    },
                    required: ["conflictId", "resolution"],
                },
            },
            {
                name: toolName("resolve_all"),
                description: "SYNC.2: Bulk-resolve all pending token sync conflicts for a project. Resolution must be 'local' or 'remote'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                        resolution: { type: "string", enum: ["local", "remote"], description: "Which value wins for all conflicts." },
                    },
                    required: ["projectRoot", "resolution"],
                },
            },
            {
                name: toolName("sync_check"),
                description: "SYNC.4: CI/CD sync health check. Returns whether tokens are in sync with Figma baseline, pending conflict count, staleness, drift count, and a recommendation (ok, pull_needed, push_needed, conflicts_pending).",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("sync_history"),
                description: "SYNC.4: Export sync history for a project as JSON or CSV.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                        format: { type: "string", enum: ["json", "csv"], description: "Export format (default: 'json')." },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("validate_themes"),
                description: "EXP.4: Validate a single codebase against multiple brand/theme token sets. Returns a cross-theme compliance matrix showing which violations are theme-specific vs universal.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                        themeFiles: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of paths to DTCG token files (.json). Absolute or relative to projectRoot.",
                        },
                        filePaths: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of .tsx/.jsx file paths to validate. Defaults to glob '**/*.tsx' if omitted.",
                        },
                    },
                    required: ["projectRoot", "themeFiles"],
                },
            },
            {
                name: toolName("migrate_ds"),
                description: "EXP.5: Design System Version Migration. Computes a diff between two DTCG token files (renamed, removed, changed, added) and surgically updates consuming code via Babel AST. Returns a migration report with per-file changes and warnings. Color changes include CIEDE2000 ΔE scores.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to the project root." },
                        oldTokens: { type: "string", description: "Path to the old DTCG token file (.json). Absolute or relative to projectRoot." },
                        newTokens: { type: "string", description: "Path to the new DTCG token file (.json). Absolute or relative to projectRoot." },
                        filePaths: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of .tsx/.jsx file paths to migrate. Defaults to glob '**/*.tsx' if omitted.",
                        },
                        dryRun: { type: "boolean", description: "When true (default), report changes without writing to disk." },
                    },
                    required: ["projectRoot", "oldTokens", "newTokens"],
                },
            },
            FLINT_UNIVERSAL_AUDIT_TOOL,
            FLINT_ENRICH_REGISTRY_TOOL,
            FLINT_APPROVE_ENRICHMENT_TOOL,
            FLINT_REINDEX_REGISTRY_TOOL,
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
                uri: resourceUri("session-context"),
                name: BRAND.product + " Session Context",
                mimeType: "application/json",
                description: "Rich session context snapshot — active file, violations, tokens, health score, recent mutations. Read this FIRST to eliminate cold-start round-trips. Assembly budget < 100ms.",
            },
            {
                uri: resourceUri("tokens"),
                name: BRAND.product + " Design Tokens",
                mimeType: "application/json",
                description: "The current set of normalized design tokens from " + configPath('design-tokens.json')
            },
            {
                uri: resourceUri("manifest"),
                name: BRAND.product + " Project Manifest",
                mimeType: "application/json",
                description: "The global architecture manifest (" + BRAND.manifestFile + ") defining codebase components and logic."
            },
            {
                uri: resourceUri("rules"),
                name: BRAND.product + " Governance Rules",
                mimeType: "application/json",
                description: "All loaded governance rules, grouped by domain."
            },
            {
                uri: resourceUri("violations/{filePath}"),
                name: BRAND.product + " Violations",
                mimeType: "application/json",
                description: "Live governance audit for a specific file path."
            },
            {
                uri: resourceUri("dashboard"),
                name: BRAND.product + " Design Debt Dashboard",
                mimeType: "application/json",
                description: "Design debt dashboard — current health score, letter grade, violation summary, and last 10 trend snapshots from " + configPath('debt-history.json') + "."
            },
            {
                uri: resourceUri("policy"),
                name: BRAND.product + " Governance Policy",
                mimeType: "application/json",
                description: "The active governance policy (" + configPath('policy.json') + ") — Mithril thresholds, A11y mode, export gate settings."
            },
            {
                uri: resourceUri("dbom"),
                name: BRAND.product + " Design Bill of Materials",
                mimeType: "application/json",
                description: "Design Bill of Materials (DBOM) — machine-readable manifest of all design tokens, component compliance, token coverage, and governance status. Regenerated on demand; returns cached result if available."
            },
            {
                uri: resourceUri("overrides"),
                name: BRAND.product + " Override Telemetry",
                mimeType: "application/json",
                description: "Override telemetry summary — total count, overrides by rule, by session, last 24h count, and last override timestamp. GOV.2."
            },
            {
                uri: resourceUri("agent-risk"),
                name: BRAND.product + " Agent Risk Dashboard",
                mimeType: "application/json",
                description: "Per-agent risk profiles — mutation counts, average risk scores, red/amber/green tier breakdown, override counts. AGV.2."
            },
            {
                uri: resourceUri("anomalies"),
                name: BRAND.product + " Anomaly Detection",
                mimeType: "application/json",
                description: "Current anomaly count and latest detected anomalies from statistical baseline analysis. GOV.4."
            },
            {
                uri: resourceUri("figma-connection"),
                name: BRAND.product + " Figma Connection",
                mimeType: "application/json",
                description: "Current Figma file connection status, file key, last sync timestamp. SYNC.1."
            }
        ]
    };
});

/**
 * Read a specific resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const projectRoot = process.cwd();

    if (request.params.uri === resourceUri("capabilities")) {
        return {
            contents: [{
                uri: resourceUri("capabilities"),
                mimeType: "application/json",
                text: readCapabilities(),
            }]
        };
    }

    if (request.params.uri === resourceUri("tokens")) {
        const tokensPath = path.join(projectRoot, configPath("design-tokens.json"));
        if (!fs.existsSync(tokensPath)) {
            throw new Error(`Design tokens file not found at ${tokensPath}`);
        }
        return {
            contents: [{
                uri: resourceUri("tokens"),
                mimeType: "application/json",
                text: fs.readFileSync(tokensPath, "utf-8")
            }]
        };
    }

    if (request.params.uri === resourceUri("manifest")) {
        const manifestPath = path.join(projectRoot, BRAND.manifestFile);
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Manifest file not found at ${manifestPath}`);
        }
        return {
            contents: [{
                uri: resourceUri("manifest"),
                mimeType: "application/json",
                text: fs.readFileSync(manifestPath, "utf-8")
            }]
        };
    }

    if (request.params.uri === resourceUri("rules")) {
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
                uri: resourceUri("rules"),
                mimeType: "application/json",
                text: JSON.stringify(allRules, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("dashboard")) {
        const dashboard = generateDashboard(projectRoot);
        return {
            contents: [{
                uri: resourceUri("dashboard"),
                mimeType: "application/json",
                text: JSON.stringify(dashboard, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("policy")) {
        const policy = readPolicy(projectRoot);
        return {
            contents: [{
                uri: resourceUri("policy"),
                mimeType: "application/json",
                text: JSON.stringify(policy, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("dbom")) {
        // Serve cached DBOM if available; otherwise generate fresh.
        const cached = getCachedDBOM();
        let dbom = cached;
        if (dbom === null) {
            dbom = await (await import("./core/dbom/generator.js")).generateDBOM(projectRoot);
        }
        return {
            contents: [{
                uri: resourceUri("dbom"),
                mimeType: "application/json",
                text: JSON.stringify(dbom, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("session-context")) {
        const sessionCtx = await assembleSessionContext(projectRoot);
        return {
            contents: [{
                uri: resourceUri("session-context"),
                mimeType: "application/json",
                text: JSON.stringify(sessionCtx, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("overrides")) {
        try {
            const overrideSvc = getOverrideTelemetryService(projectRoot);
            const summary = overrideSvc.getOverrideSummary(projectRoot);
            return {
                contents: [{
                    uri: resourceUri("overrides"),
                    mimeType: "application/json",
                    text: JSON.stringify(summary, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("overrides"),
                    mimeType: "application/json",
                    text: JSON.stringify({ totalOverrides: 0, byRule: [], bySession: [], last24hCount: 0, lastOverrideAt: null }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri === resourceUri("agent-risk")) {
        try {
            const svc = getAgentRiskService(projectRoot);
            const summary = svc.getAgentRiskSummary(projectRoot);
            return {
                contents: [{
                    uri: resourceUri("agent-risk"),
                    mimeType: "application/json",
                    text: JSON.stringify(summary, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("agent-risk"),
                    mimeType: "application/json",
                    text: JSON.stringify({ agents: [], topRiskiest: [], period: "last_7_days" }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri === resourceUri("anomalies")) {
        try {
            const svc = getAnomalyDetectionService(projectRoot);
            const history = svc.getAnomalyHistory(projectRoot, 10);
            return {
                contents: [{
                    uri: resourceUri("anomalies"),
                    mimeType: "application/json",
                    text: JSON.stringify({ count: history.length, anomalies: history }, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("anomalies"),
                    mimeType: "application/json",
                    text: JSON.stringify({ count: 0, anomalies: [] }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri === resourceUri("figma-connection")) {
        try {
            const connSvc = getSyncConnectionService(projectRoot);
            const conn = connSvc.getConnection(projectRoot);
            return {
                contents: [{
                    uri: resourceUri("figma-connection"),
                    mimeType: "application/json",
                    text: JSON.stringify(conn ?? { status: "disconnected", projectRoot }, null, 2),
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("figma-connection"),
                    mimeType: "application/json",
                    text: JSON.stringify({ status: "disconnected", projectRoot }, null, 2),
                }]
            };
        }
    }

    if (request.params.uri.startsWith(resourceUri("violations/"))) {
        const filePath = "/" + request.params.uri.replace(resourceUri("violations/"), "");
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const source = fs.readFileSync(filePath, "utf-8");
        const auditResult = await handleFlintAudit({ source, filePath }, flintConfig);
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
                name: BRAND.productLower + "-intent-composer",
                description: "The primary directive for the " + BRAND.product + " UX/UI Architecture Sentinel. Use this when drafting or modifying UI components based on Figma design intent.",
            },
            FLINT_SENTINEL_PROMPT_DEF,
            WORKFLOW_GUIDE_PROMPT,
        ]
    };
});

/**
 * Handle get prompt request.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === BRAND.productLower + "-intent-composer") {
        return {
            description: BRAND.product + " UX/UI Architecture Sentinel Persona",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `You are the ${BRAND.product} UX/UI Architecture Sentinel. You operate under the ${BRAND.product} Containment Field.

Your objective is to translate design intent from Figma into high-fidelity React code while maintaining strict design system integrity.

COMMANDMENTS:
1. You MUST read the design tokens from ${resourceUri("tokens")} to resolve all styles.
2. You MUST call ${toolName("query_registry")} before drafting any UI components to ensure you use existing design system components.
3. You MUST run all drafted code through the audit_ui_component tool to verify Mithril and A11y compliance.
4. You MUST ONLY use apply_ast_mutations to commit changes to the codebase. Raw string replacements or regex-based edits are strictly prohibited (Commandment 13 & 15).

HALT CRITERIA:
If you encounter a "BLOCKED" status from any tool (Mithril violation, A11y violation, or design drift), you must immediately halt execution. Display the "${BRAND.product} Ledger" artifact to the user detailing the violations and refuse to commit the code until the issues are resolved.
`
                    }
                }
            ]
        };
    }

    if (request.params.name === BRAND.productLower + "-sentinel") {
        const domain = (request.params.arguments as Record<string, string> | undefined)?.domain ?? "general";
        return {
            description: BRAND.product + " Governance Engine — " + domain + " domain persona",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getFlintSentinelContent(domain),
                    },
                }
            ]
        };
    }

    if (request.params.name === BRAND.productLower + "-workflow-guide") {
        const intent = (request.params.arguments as Record<string, string> | undefined)?.intent;
        return {
            description: BRAND.product + " MCP workflow composition guide — maps user intent to multi-tool sequences",
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
        case "flint_get_context": {
            const { projectRoot: ctxRoot } = request.params.arguments as { projectRoot: string };
            if (!ctxRoot || typeof ctxRoot !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_get_context: 'projectRoot' parameter is required." }],
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

        case "flint_assess_complexity": {
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
                    content: [{ type: "text", text: "flint_assess_complexity: 'taskDescription' parameter is required." }],
                };
            }
            let ctxForComplexity: SessionContext | null = null;
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

        case "flint_status": {
            return withResponseMeta({
                content: [
                    {
                        type: "text",
                        text: `${BRAND.product} Protocol Active: Standalone Mode. Mithril, A11y, Figma Hydration, and AST Mutation engines ready.`,
                    },
                ],
            }, 'cached', 0, 1.0);
        }

        case "audit_ui_component": {
            const finishAudit = startResponseTimer('ast');
            const _auditArgs = request.params.arguments as { file?: string; componentPath?: string };
            const file = _auditArgs.file ?? _auditArgs.componentPath;
            const componentPath = file && path.isAbsolute(file) ? file : path.resolve(process.cwd(), file ?? '');

            if (!fs.existsSync(componentPath)) {
                throw new Error(`File not found: ${componentPath}`);
            }

            const code = fs.readFileSync(componentPath, "utf-8");

            const projectRoot = findProjectRoot(componentPath);
            if (!projectRoot) {
                throw new Error(`Could not find project root (${BRAND.configDir} directory)`);
            }
            const telemetry = new TelemetryLogger(projectRoot);

            const tokensPath = path.join(projectRoot, configPath("design-tokens.json"));
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
                    deltaE_threshold: flintConfig.policy.mithril.deltaE_threshold,
                    deltaE_critical_threshold: flintConfig.policy.mithril.deltaE_critical_threshold,
                };
                const mithrilWarnings = flintConfig.policy.mithril.mode !== 'off'
                    ? auditAll(ast as any, tokens, policyOpts)
                    : new Map();
                const a11yResult = flintConfig.policy.a11y.mode !== 'off'
                    ? A11yLinter.auditStructured(ast as any, componentPath)
                    : { filePath: componentPath, totalRules: 0, passed: 0, failed: 0, compliancePercent: 100, violations: [], criterionResults: [], fixableCount: 0, timestamp: new Date().toISOString() };

                const mithrilCount = mithrilWarnings.size;
                const a11yCount = a11yResult.violations.length;
                const hasViolations = mithrilCount > 0 || a11yCount > 0;

                let outcome = "Approved";
                if (hasViolations) {
                    const firstMithril = Array.from(mithrilWarnings.values())[0];
                    if (firstMithril) {
                        outcome = `Blocked: ${firstMithril.message}`;
                    } else {
                        outcome = `Blocked: A11y Violations (${a11yCount})`;
                    }
                }

                telemetry.log({
                    tool: "audit_ui_component",
                    input_summary: `Auditing ${path.basename(componentPath)}`,
                    outcome,
                    metadata: JSON.stringify({ mithrilCount, a11yCount })
                });

                const formatted = formatAuditReport(componentPath, mithrilWarnings, a11yResult, tokens, file);

                // CX.1: summary sentence for audit_ui_component
                const auditComponentBasename = path.basename(componentPath);
                const totalViolationCount = mithrilCount + a11yCount;
                const mithrilFixableCount = Array.from(mithrilWarnings.values()).filter(w => w.fixable || w.nearestToken).length;
                const totalFixableCount = mithrilFixableCount + a11yResult.fixableCount;

                let auditComponentSummary: string;
                if (hasViolations) {
                    const parts: string[] = [];
                    if (mithrilCount > 0) parts.push(`${mithrilCount} design token`);
                    if (a11yCount > 0) parts.push(`${a11yCount} accessibility`);
                    const fixNote = totalFixableCount > 0
                        ? ` ${totalFixableCount} auto-fixable.`
                        : "";
                    auditComponentSummary = `BLOCKED: ${auditComponentBasename} — ${parts.join(", ")} violation${totalViolationCount !== 1 ? "s" : ""}.${fixNote} Run flint_fix to start remediation.`;
                } else {
                    auditComponentSummary = `APPROVED: ${auditComponentBasename} — all ${a11yResult.totalRules} rules passing. Export-ready.`;
                }

                // REM.1: Elicitation-driven remediation
                let finalSummary = auditComponentSummary;
                let finalFormatted = formatted;
                if (totalFixableCount > 0) {
                    try {
                        const remediation = await elicitRemediation(
                            server, componentPath, code, totalFixableCount, flintConfig
                        );
                        if (remediation.action === 'fixed' && remediation.fixReceipt) {
                            finalFormatted += '\n\n' + remediation.fixReceipt;
                            finalSummary = `FIXED: ${auditComponentBasename} — ${remediation.fixResult!.fixesApplied} violation(s) auto-remediated. Run audit again to verify.`;
                        } else if (remediation.action === 'dry_run' && remediation.fixResult) {
                            finalFormatted += '\n\n---\n\n## Dry Run Preview\n\n' + remediation.fixResult.summary;
                        }
                    } catch (elicitErr) {
                        // Elicitation failed (unsupported client, network, etc.) — fall through to standard report
                        console.error(`${logTag()} Elicitation failed, returning standard report:`, elicitErr);
                    }
                }

                return finishAudit({
                    content: [
                        { type: "text", text: `${finalSummary}\n\n${finalFormatted}` },
                    ],
                });
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

            const manifestPath = path.join(projectRoot, BRAND.manifestFile);
            let manifest = { components: {}, resolvers: [] };
            if (fs.existsSync(manifestPath)) {
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                } catch (e) {
                    console.error(`Failed to parse ${BRAND.manifestFile}`, e);
                }
            }

            const tokensPath = path.join(projectRoot, configPath("design-tokens.json"));
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

        case "flint_ast_mutate": {
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
                throw new Error(`Could not find project root (${BRAND.configDir} directory)`);
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
                    tool: "flint_ast_mutate",
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
                    case "emitImport": {
                        const { importSnippet: impSnippet } = mutation.args as { importSnippet: string };
                        emitImport(ast as any, impSnippet);
                        break;
                    }
                    case "emitHook": {
                        const { componentName, hookStatement, position } = mutation.args as { componentName: string; hookStatement: string; position?: 'first' | 'last' };
                        emitHook(ast as any, componentName, hookStatement, position);
                        break;
                    }
                    case "emitHandler": {
                        const { componentName: comp, handlerCode } = mutation.args as { componentName: string; handlerCode: string };
                        emitHandler(ast as any, comp, handlerCode);
                        break;
                    }
                    case "emitCallback": {
                        const { nodeId: cbNodeId, propName: cbProp, expression: cbExpr } = mutation.args as { nodeId: string; propName: string; expression: string };
                        emitCallback(ast as any, cbNodeId, cbProp, cbExpr);
                        break;
                    }
                    case "emitConditional": {
                        const { nodeId: condNodeId, condition, mode, fallback: fb } = mutation.args as { nodeId: string; condition: string; mode: 'and' | 'ternary'; fallback?: string };
                        emitConditional(ast as any, condNodeId, condition, mode, fb);
                        break;
                    }
                    case "emitMap": {
                        const { nodeId: mapNodeId, arrayExpression, iteratorName, keyExpression } = mutation.args as { nodeId: string; arrayExpression: string; iteratorName: string; keyExpression: string };
                        emitMap(ast as any, mapNodeId, arrayExpression, iteratorName, keyExpression);
                        break;
                    }
                    case "composeSlot": {
                        const { parentId, slotName, jsxSnippet, importSnippet } = mutation.args as {
                            parentId: string; slotName: string; jsxSnippet: string; importSnippet?: string;
                        };
                        composeSlot(ast as any, parentId, slotName, jsxSnippet, importSnippet);
                        break;
                    }
                    default:
                        console.warn(`Unknown mutation type: ${mutation.type}`);
                }
            }

            const { code: newCode } = generate(ast);
            const batchId = crypto.randomUUID();

            if (effectiveWriteFile) {
                // Commandment 12: atomic write via .tmp → rename
                const tmpPath = targetPath + `${BRAND.configDir}-tmp-` + crypto.randomUUID().slice(0, 8);
                fs.writeFileSync(tmpPath, newCode, "utf-8");
                fs.renameSync(tmpPath, targetPath);
                telemetry.log({
                    tool: "flint_ast_mutate",
                    input_summary: `Mutated ${path.basename(targetPath)} (${mutations.length} mutations)`,
                    outcome: "Success",
                    metadata: JSON.stringify({ mutationsCount: mutations.length, batchId })
                });
            } else {
                telemetry.log({
                    tool: "flint_ast_mutate",
                    input_summary: `Dry run mutation for ${path.basename(targetPath)}`,
                    outcome: "Approved",
                    metadata: JSON.stringify({ mutationsCount: mutations.length, batchId })
                });
            }

            // CX.1: Build summary for flint_ast_mutate
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
                const enrichment = enrichToolCall("flint_ast_mutate", request.params.arguments as Record<string, unknown>, enrichCtx);
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
                    const agentId = typeof args.agentId === "string" ? args.agentId : "flint_ast_mutate";
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

            const intentPath = path.join(projectRoot, configPath('current-intent.json'));

            if (!fs.existsSync(intentPath)) {
                return {
                    content: [{
                        type: "text",
                        text: "No design intent found. Push a component or page from the Figma plugin first.",
                    }],
                };
            }

            try {
                const intent = JSON.parse(fs.readFileSync(intentPath, 'utf-8')) as FlintSDIPayload;
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

        case "flint_query_registry": {
            const finishRegistry = startResponseTimer('heuristic');
            const _registryArgs = request.params.arguments as {
                query?: string;
                semantic_query?: string;
                limit?: number;
                projectRoot?: string;
            };
            const query = _registryArgs.query ?? _registryArgs.semantic_query ?? '';
            const { limit = 3, projectRoot: projectRootArg } = _registryArgs;
            const projectRoot = projectRootArg ?? process.cwd();

            if (!query) {
                throw new Error("Missing required parameter: query or semantic_query");
            }

            if (!fs.existsSync(projectRoot)) {
                throw new Error(`Project root not found: ${projectRoot}`);
            }

            // Hydrate the RAG cache with the local manifest so freshly-opened
            // projects are searchable without a prior flint_add_remote_library call.
            {
                const localManifestPath = path.join(projectRoot, BRAND.manifestFile);
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
                matches = await queryRAGRegistry(query, limit);
            } catch (err) {
                console.error(`${logTag("Registry")} RAG search failed, falling back to manifest relevance`, err);

                const manifestPath = path.join(projectRoot, BRAND.manifestFile);
                let components: Record<string, any> = {};

                if (fs.existsSync(manifestPath)) {
                    try {
                        const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                        components = raw.components ?? {};
                    } catch (err: any) {
                        console.error("Failed to parse manifest for fallback", err);
                    }
                }
                matches = queryRegistry(components, query, Math.max(1, Math.min(limit, 10)));
            }

            const artifact = formatShadowStorybook(matches, query);
            return finishRegistry({ content: [{ type: "text", text: artifact }] });
        }


        case "flint_audit": {
            const auditArgs = request.params.arguments as {
                source: string;
                filePath: string;
                filePaths?: string[];
                ruleIds?: string[];
                severity?: "info" | "warning" | "critical";
                healOnAudit?: boolean;
            };
            if (auditArgs.filePaths && auditArgs.filePaths.length > 0) {
                const batchResult = await handleFlintAuditBatch(
                    auditArgs.filePaths,
                    { ruleIds: auditArgs.ruleIds, severity: auditArgs.severity },
                    flintConfig,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(batchResult, null, 2) }],
                };
            }
            const auditResult = await handleFlintAudit(auditArgs, flintConfig);
            const auditResultText = JSON.stringify(auditResult, null, 2);
            // ACX.3: Append token context to audit results
            let enrichedAuditText = auditResultText;
            try {
                enrichedAuditText = enrichToolResult(
                    "flint_audit",
                    request.params.arguments as Record<string, unknown>,
                    auditResultText,
                    flintConfig.projectRoot,
                );
            } catch {
                // Enrichment is best-effort — never block the audit result
            }

            // GOV.2: Record override telemetry when audit runs with disabled rules.
            // Fire-and-forget — never blocks the audit response.
            try {
                const disabledRules = flintConfig.policy.a11y.disabled_rules;
                const mithrilOff = flintConfig.policy.mithril.mode === "off";
                if ((disabledRules.length > 0 || mithrilOff) && auditArgs.filePath) {
                    const ovrSvc = getOverrideTelemetryService(flintConfig.projectRoot);
                    for (const ruleId of disabledRules) {
                        ovrSvc.recordOverride({
                            id: crypto.randomUUID(),
                            nodeId: null,
                            ruleId,
                            sessionId: null,
                            agentId: "flint_audit",
                            timestamp: new Date().toISOString(),
                            projectRoot: flintConfig.projectRoot,
                            reason: `Rule ${ruleId} skipped during audit of ${path.basename(auditArgs.filePath)}`,
                        });
                    }
                    if (mithrilOff) {
                        ovrSvc.recordOverride({
                            id: crypto.randomUUID(),
                            nodeId: null,
                            ruleId: "MITHRIL-ALL",
                            sessionId: null,
                            agentId: "flint_audit",
                            timestamp: new Date().toISOString(),
                            projectRoot: flintConfig.projectRoot,
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

        case "flint_fix": {
            const fixArgs = request.params.arguments as {
                source: string;
                filePath: string;
                violationIds?: string[];
                dryRun?: boolean;
            };
            const fixResult = await handleFlintFix(fixArgs, flintConfig);
            const fixResultText = JSON.stringify(fixResult, null, 2);
            // ACX.3: Prepend node context preamble to fix results
            let enrichedFixText = fixResultText;
            try {
                enrichedFixText = enrichToolResult(
                    "flint_fix",
                    request.params.arguments as Record<string, unknown>,
                    fixResultText,
                    flintConfig.projectRoot,
                );
            } catch {
                // Enrichment is best-effort — never block the fix result
            }

            // V.2-mp: Record provenance when flint_fix actually applied fixes.
            if (fixResult.fixesApplied > 0 && !fixArgs.dryRun) {
                try {
                    const fixProjectRoot = findProjectRoot(fixArgs.filePath) ?? flintConfig.projectRoot;
                    const provSvc = getProvenanceService(fixProjectRoot);
                    const fixMutationId = crypto.randomUUID();
                    provSvc.recordProvenance(
                        fixMutationId,
                        "auto-fix",
                        "flint_fix",
                        null,
                        `flint_fix applied ${fixResult.fixesApplied} token fix(es) to ${path.basename(fixArgs.filePath)}`,
                        null,
                    );
                } catch {
                    // Provenance recording is best-effort — never block fix result
                }
            }

            // GOV.2: Record override telemetry when flint_fix applies token corrections.
            // Each fix represents an override of the design system that was corrected.
            // Fire-and-forget — never blocks the fix response.
            if (fixResult.fixesApplied > 0) {
                try {
                    const fixProjectRoot = findProjectRoot(fixArgs.filePath) ?? flintConfig.projectRoot;
                    const ovrSvc = getOverrideTelemetryService(fixProjectRoot);
                    ovrSvc.recordOverride({
                        id: crypto.randomUUID(),
                        nodeId: null,
                        ruleId: "MITHRIL-TOKEN-DRIFT",
                        sessionId: null,
                        agentId: "flint_fix",
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

        case "flint_swarm_audit_fix": {
            const swarmArgs = request.params.arguments as {
                glob: string;
                autoFix?: boolean;
                dryRun?: boolean;
                projectRoot: string;
            };
            const swarmResult = await handleFlintSwarmAuditFix(swarmArgs, flintConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(swarmResult, null, 2) }],
            };
        }

        case "flint_ingest_figma": {
            const ingestArgs = request.params.arguments as {
                figmaPayload: string;
                figmaUrl?: string;
                outputFormat?: "jsx" | "tsx" | "vue";
                componentName?: string;
            };
            const result = await handleFlintIngest(ingestArgs, flintConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        case "flint_sync_tokens": {
            const syncArgs = request.params.arguments as {
                direction: "figma-to-local" | "diff-only";
                localTokensPath?: string;
                incomingTokens?: string;
            };
            const result = await handleFlintSync(syncArgs, flintConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        case "flint_audit_report": {
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

        case "flint_debt_report": {
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

            // CX.1: Build summary for flint_debt_report
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

        case "flint_set_policy": {
            const { action, policy: policyUpdate } = request.params.arguments as {
                action: "read" | "update" | "reset";
                policy?: Partial<FlintPolicy>;
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
                                text: "flint_set_policy: 'update' action requires a 'policy' object with partial policy fields.",
                            }],
                        };
                    }
                    const merged = mergePolicy(projectRoot, policyUpdate);
                    // Reload into active config so subsequent audits use new thresholds
                    flintConfig = loadConfig(projectRoot);

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
                                agentId: "flint_set_policy",
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
                                    agentId: "flint_set_policy",
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
                    flintConfig = loadConfig(projectRoot);
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
                            text: `flint_set_policy: unknown action '${action}'. Must be 'read', 'update', or 'reset'.`,
                        }],
                    };
            }
        }

        case "flint_accessibility_report": {
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

        case "flint_generate_dbom": {
            const dbomArgs = request.params.arguments as {
                projectRoot?: string;
                format?: "json" | "markdown" | "cyclonedx";
                includeProvenance?: boolean;
            };
            return handleGenerateDBOM(dbomArgs, process.cwd());
        }

        case "flint_add_remote_library": {
            const remoteArgs = request.params.arguments as {
                githubUrl: string;
                branch?: string;
                manifestPath?: string;
                alias?: string;
                projectRoot: string;
            };
            const remoteResult = await handleFlintAddRemoteLibrary(remoteArgs);
            return {
                content: [{ type: "text", text: JSON.stringify(remoteResult, null, 2) }],
            };
        }

        case "flint_plan": {
            const planResult = handleFlintPlan(
                request.params.arguments as unknown as FlintPlanParams,
                flintConfig,
            );
            return planResult;
        }

        case "flint_mutation_provenance": {
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
                        text: "flint_mutation_provenance: 'projectRoot' must be an existing directory.",
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
                                text: "flint_mutation_provenance: action='audit_trail' requires 'filePath'.",
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
                                text: "flint_mutation_provenance: action='by_source' requires 'source'.",
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
                            text: `flint_mutation_provenance: unknown action '${(provArgs as { action: string }).action}'. Must be 'summary', 'audit_trail', or 'by_source'.`,
                        }],
                    };
                }
            }
        }

        case "flint_agent_risk": {
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
                        text: "flint_agent_risk: 'projectRoot' must be an existing directory.",
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
                                text: "flint_agent_risk: action='by_agent' requires 'agentId'.",
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
                            text: `flint_agent_risk: unknown action '${(arArgs as { action: string }).action}'. Must be 'summary' or 'by_agent'.`,
                        }],
                    };
                }
            }
        }

        case "flint_override_telemetry": {
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
                        text: "flint_override_telemetry: 'projectRoot' must be an existing directory.",
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
                                text: "flint_override_telemetry: action='by_session' requires 'sessionId'.",
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
                                text: "flint_override_telemetry: action='by_rule' requires 'ruleId'.",
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
                            text: `flint_override_telemetry: unknown action '${(ovrArgs as { action: string }).action}'. Must be 'summary', 'by_session', or 'by_rule'.`,
                        }],
                    };
                }
            }
        }

        case "flint_anomaly_report": {
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
                        text: "flint_anomaly_report: 'projectRoot' must be an existing directory.",
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
                            text: `flint_anomaly_report: unknown action '${(anomArgs as { action: string }).action}'. Must be 'detect', 'history', or 'baseline'.`,
                        }],
                    };
                }
            }
        }

        case "flint_risk_score": {
            const riskArgs = request.params.arguments as {
                action: "score_mutation" | "file_profile" | "project_summary";
                projectRoot: string;
                mutationId?: string;
                filePath?: string;
                violationCount?: number;
                hasCritical?: boolean;
                wasAutoFixedFromCritical?: boolean;
            };

            if (!riskArgs.projectRoot || !fs.existsSync(riskArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "flint_risk_score: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const riskSvc = getRiskScoringService(riskArgs.projectRoot);

            switch (riskArgs.action) {
                case "score_mutation": {
                    if (!riskArgs.mutationId) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "flint_risk_score: action='score_mutation' requires 'mutationId'.",
                            }],
                        };
                    }
                    const result = riskSvc.scoreMutation(riskArgs.mutationId, {
                        violationCount: riskArgs.violationCount,
                        hasCritical: riskArgs.hasCritical,
                        wasAutoFixedFromCritical: riskArgs.wasAutoFixedFromCritical,
                    });
                    if (result === null) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: `flint_risk_score: no ledger entry found for mutationId '${riskArgs.mutationId}'.`,
                            }],
                        };
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "file_profile": {
                    if (!riskArgs.filePath) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: "flint_risk_score: action='file_profile' requires 'filePath'.",
                            }],
                        };
                    }
                    const profile = riskSvc.getFileRiskProfile(riskArgs.filePath);
                    if (profile === null) {
                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({ filePath: riskArgs.filePath, message: "No risk scores recorded for this file." }, null, 2),
                            }],
                        };
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
                    };
                }

                case "project_summary": {
                    const summary = riskSvc.getProjectRiskSummary();
                    return {
                        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `flint_risk_score: unknown action '${(riskArgs as { action: string }).action}'. Must be 'score_mutation', 'file_profile', or 'project_summary'.`,
                        }],
                    };
                }
            }
        }

        case "flint_migrate_tw": {
            const twArgs = request.params.arguments as {
                filePaths: string[];
                glob?: string;
                dryRun?: boolean;
                from?: "3";
                to?: "4";
            };

            // Prevent path traversal in glob patterns
            if (twArgs.glob && (twArgs.glob.includes('..') || path.isAbsolute(twArgs.glob))) {
                throw new Error('Invalid glob: path traversal and absolute paths are not permitted');
            }


            if (!Array.isArray(twArgs.filePaths) || twArgs.filePaths.length === 0) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "flint_migrate_tw: 'filePaths' must be a non-empty array of absolute file paths.",
                    }],
                };
            }

            const dryRun = twArgs.dryRun !== false; // default true
            const perFileReports: Array<{
                filePath: string;
                fileChanged: boolean;
                changeCount: number;
                changes: MigrateResult["changes"];
                auditViolationCount: number | null;
                error?: string;
            }> = [];

            for (const filePath of twArgs.filePaths) {
                if (!fs.existsSync(filePath)) {
                    perFileReports.push({
                        filePath,
                        fileChanged: false,
                        changeCount: 0,
                        changes: [],
                        auditViolationCount: null,
                        error: `File not found: ${filePath}`,
                    });
                    continue;
                }

                let migResult: MigrateResult;
                try {
                    const source = fs.readFileSync(filePath, "utf-8");
                    migResult = migrateFile(source, { dryRun, filePath, from: twArgs.from, to: twArgs.to });
                    if (!dryRun && migResult.fileChanged) {
                        fs.writeFileSync(filePath, migResult.migratedSource, "utf-8");
                    }
                } catch (err) {
                    perFileReports.push({
                        filePath,
                        fileChanged: false,
                        changeCount: 0,
                        changes: [],
                        auditViolationCount: null,
                        error: err instanceof Error ? err.message : String(err),
                    });
                    continue;
                }

                // Post-migration audit on migrated source
                let auditViolationCount: number | null = null;
                if (migResult.fileChanged || !dryRun) {
                    try {
                        const sourceToAudit = migResult.fileChanged
                            ? migResult.migratedSource
                            : fs.readFileSync(filePath, "utf-8");
                        const auditResult = await handleFlintAudit(
                            { source: sourceToAudit, filePath },
                            flintConfig,
                        );
                        auditViolationCount = auditResult.violations
                            ? (auditResult.violations as unknown[]).length
                            : 0;
                    } catch {
                        // Audit is best-effort — never block migration result
                    }
                }

                perFileReports.push({
                    filePath,
                    fileChanged: migResult.fileChanged,
                    changeCount: migResult.changes.length,
                    changes: migResult.changes,
                    auditViolationCount,
                });
            }

            const totalChanged = perFileReports.filter(r => r.fileChanged).length;
            const totalChanges = perFileReports.reduce((acc, r) => acc + r.changeCount, 0);
            const summary =
                dryRun
                    ? `Dry-run complete. ${totalChanges} class replacement(s) found across ${totalChanged}/${twArgs.filePaths.length} file(s). No files were written.`
                    : `Migration complete. ${totalChanges} class replacement(s) applied across ${totalChanged}/${twArgs.filePaths.length} file(s).`;

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ summary, dryRun, files: perFileReports }, null, 2),
                }],
            };
        }

        case "flint_agent_trust": {
            const trustArgs = request.params.arguments as {
                action: "profile" | "list" | "promote" | "demote" | "reset";
                projectRoot: string;
                agentId?: string;
                targetTier?: TrustTier;
            };

            if (!trustArgs.projectRoot || !fs.existsSync(trustArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "flint_agent_trust: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const trustSvc = getTrustTierService(trustArgs.projectRoot);

            switch (trustArgs.action) {
                case "list": {
                    const all = trustSvc.listAll();
                    return {
                        content: [{ type: "text", text: JSON.stringify(all, null, 2) }],
                    };
                }

                case "profile": {
                    if (!trustArgs.agentId) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "flint_agent_trust: action='profile' requires 'agentId'." }],
                        };
                    }
                    const profile = trustSvc.getAgentTrustProfile(trustArgs.agentId);
                    return {
                        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
                    };
                }

                case "promote": {
                    if (!trustArgs.agentId || !trustArgs.targetTier) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "flint_agent_trust: action='promote' requires 'agentId' and 'targetTier'." }],
                        };
                    }
                    const promoted = trustSvc.manualPromote(trustArgs.agentId, trustArgs.targetTier);
                    return {
                        content: [{ type: "text", text: JSON.stringify(promoted, null, 2) }],
                    };
                }

                case "demote": {
                    if (!trustArgs.agentId) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "flint_agent_trust: action='demote' requires 'agentId'." }],
                        };
                    }
                    const demoted = trustSvc.manualDemote(trustArgs.agentId);
                    return {
                        content: [{ type: "text", text: JSON.stringify(demoted, null, 2) }],
                    };
                }

                case "reset": {
                    if (!trustArgs.agentId) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "flint_agent_trust: action='reset' requires 'agentId'." }],
                        };
                    }
                    const resetResult = trustSvc.resetTrust(trustArgs.agentId);
                    return {
                        content: [{ type: "text", text: JSON.stringify(resetResult, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `flint_agent_trust: unknown action '${(trustArgs as { action: string }).action}'. Must be 'profile', 'list', 'promote', 'demote', or 'reset'.`,
                        }],
                    };
                }
            }
        }

        case "flint_figma_connect": {
            const syncArgs = request.params.arguments as {
                action: "connect" | "disconnect" | "status";
                projectRoot: string;
                fileKey?: string;
                accessToken?: string;
                fileName?: string;
            };

            if (!syncArgs.projectRoot || !fs.existsSync(syncArgs.projectRoot)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: "flint_figma_connect: 'projectRoot' must be an existing directory.",
                    }],
                };
            }

            const connSvc = getSyncConnectionService(syncArgs.projectRoot);

            switch (syncArgs.action) {
                case "connect": {
                    if (!syncArgs.fileKey || !syncArgs.accessToken) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "flint_figma_connect: action='connect' requires 'fileKey' and 'accessToken'." }],
                        };
                    }
                    const conn = connSvc.createConnection(
                        syncArgs.projectRoot,
                        syncArgs.fileKey,
                        syncArgs.accessToken,
                        syncArgs.fileName,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(conn, null, 2) }],
                    };
                }

                case "disconnect": {
                    const disconnected = connSvc.disconnectConnection(syncArgs.projectRoot);
                    return {
                        content: [{ type: "text", text: JSON.stringify({ disconnected }, null, 2) }],
                    };
                }

                case "status": {
                    const conn = connSvc.getConnection(syncArgs.projectRoot);
                    return {
                        content: [{ type: "text", text: JSON.stringify(conn ?? { status: "disconnected" }, null, 2) }],
                    };
                }

                default: {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `flint_figma_connect: unknown action '${(syncArgs as { action: string }).action}'. Must be 'connect', 'disconnect', or 'status'.`,
                        }],
                    };
                }
            }
        }

        // -----------------------------------------------------------------
        // SYNC.2 — Three-Way Diff Sync Tools
        // -----------------------------------------------------------------

        case "flint_sync_pull": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_sync_pull: 'projectRoot' must be an existing directory." }] };
            }
            try {
                const engine = getSyncEngine(args.projectRoot);
                const result = await engine.executePull(args.projectRoot);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (err: unknown) {
                return { isError: true, content: [{ type: "text", text: `flint_sync_pull failed: ${(err as Error).message}` }] };
            }
        }

        case "flint_sync_push": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_sync_push: 'projectRoot' must be an existing directory." }] };
            }
            try {
                const engine = getSyncEngine(args.projectRoot);
                const result = await engine.executePush(args.projectRoot);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (err: unknown) {
                return { isError: true, content: [{ type: "text", text: `flint_sync_push failed: ${(err as Error).message}` }] };
            }
        }

        case "flint_resolve_conflict": {
            const args = request.params.arguments as { conflictId: string; resolution: "local" | "remote" | "merged"; mergedValue?: string };
            if (!args.conflictId || !args.resolution) {
                return { isError: true, content: [{ type: "text", text: "flint_resolve_conflict: 'conflictId' and 'resolution' are required." }] };
            }
            if (args.resolution === "merged" && !args.mergedValue) {
                return { isError: true, content: [{ type: "text", text: "flint_resolve_conflict: 'mergedValue' is required when resolution is 'merged'." }] };
            }
            // We need a projectRoot to get the engine. Look up conflict across all engines, or require projectRoot.
            // For simplicity, iterate cached engines to find the conflict.
            let resolveResult: { resolved: boolean; tokenName: string | null } = { resolved: false, tokenName: null };
            for (const [, engine] of _syncEngines) {
                resolveResult = engine.resolveConflict(args.conflictId, args.resolution, args.mergedValue);
                if (resolveResult.resolved) break;
            }
            return { content: [{ type: "text", text: JSON.stringify(resolveResult, null, 2) }] };
        }

        case "flint_resolve_all": {
            const args = request.params.arguments as { projectRoot: string; resolution: "local" | "remote" };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_resolve_all: 'projectRoot' must be an existing directory." }] };
            }
            if (!args.resolution || !["local", "remote"].includes(args.resolution)) {
                return { isError: true, content: [{ type: "text", text: "flint_resolve_all: 'resolution' must be 'local' or 'remote'." }] };
            }
            const engine = getSyncEngine(args.projectRoot);
            const result = engine.resolveAllConflicts(args.projectRoot, args.resolution);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "flint_sync_check": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_sync_check: 'projectRoot' must be an existing directory." }] };
            }
            const checkSvc = getSyncCheckService(args.projectRoot);
            const report = checkSvc.runSyncCheck(args.projectRoot);
            const summary = report.inSync
                ? "Sync status: OK — tokens are in sync with baseline."
                : `Sync status: ${report.recommendation}. ${report.pendingConflicts} conflict(s), ${report.tokensDrifted} token(s) drifted.`;
            return { content: [{ type: "text", text: summary }, { type: "text", text: JSON.stringify(report, null, 2) }] };
        }

        case "flint_sync_history": {
            const args = request.params.arguments as { projectRoot: string; format?: "json" | "csv" };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_sync_history: 'projectRoot' must be an existing directory." }] };
            }
            const historySvc = getSyncHistoryService(args.projectRoot);
            const exported = historySvc.exportHistory(args.projectRoot, args.format ?? "json");
            const mimeType = args.format === "csv" ? "text/csv" : "application/json";
            return { content: [{ type: "text", text: exported }] };
        }

        case "flint_validate_themes": {
            const args = request.params.arguments as {
                projectRoot: string;
                themeFiles: string[];
                filePaths?: string[];
            };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_validate_themes: 'projectRoot' must be an existing directory." }] };
            }
            if (!Array.isArray(args.themeFiles)) {
                return { isError: true, content: [{ type: "text", text: "flint_validate_themes: 'themeFiles' must be an array of token file paths." }] };
            }
            // SEC.5-style path traversal check: all themeFiles must resolve within projectRoot
            const resolvedRoot_vt = path.resolve(args.projectRoot);
            for (const tf of args.themeFiles) {
                const resolved = path.resolve(resolvedRoot_vt, tf);
                if (!resolved.startsWith(resolvedRoot_vt + path.sep) && resolved !== resolvedRoot_vt) {
                    return { isError: true, content: [{ type: "text", text: `flint_validate_themes: path '${tf}' escapes projectRoot.` }] };
                }
            }
            if (args.filePaths) {
                for (const fp of args.filePaths) {
                    const resolved = path.resolve(resolvedRoot_vt, fp);
                    if (!resolved.startsWith(resolvedRoot_vt + path.sep) && resolved !== resolvedRoot_vt) {
                        return { isError: true, content: [{ type: "text", text: `flint_validate_themes: path '${fp}' escapes projectRoot.` }] };
                    }
                }
            }
            // Default filePaths: glob **/*.tsx
            let targetFiles = args.filePaths;
            if (!targetFiles || targetFiles.length === 0) {
                const { globSync } = await import("glob");
                targetFiles = globSync("**/*.tsx", { cwd: args.projectRoot, ignore: ["node_modules/**", "dist/**"] })
                    .map((f: string) => path.resolve(args.projectRoot, f));
            }
            const report = validateThemes(args.projectRoot, args.themeFiles, targetFiles ?? []);
            return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
        }

        case "flint_migrate_ds": {
            const args = request.params.arguments as {
                projectRoot: string;
                oldTokens: string;
                newTokens: string;
                filePaths?: string[];
                dryRun?: boolean;
            };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return { isError: true, content: [{ type: "text", text: "flint_migrate_ds: 'projectRoot' must be an existing directory." }] };
            }
            // SEC.5-style path traversal check
            const resolvedRoot_md = path.resolve(args.projectRoot);
            const oldPath = path.resolve(resolvedRoot_md, args.oldTokens);
            const newPath = path.resolve(resolvedRoot_md, args.newTokens);
            if (!oldPath.startsWith(resolvedRoot_md + path.sep) && oldPath !== resolvedRoot_md) {
                return { isError: true, content: [{ type: "text", text: `flint_migrate_ds: oldTokens path '${args.oldTokens}' escapes projectRoot.` }] };
            }
            if (!newPath.startsWith(resolvedRoot_md + path.sep) && newPath !== resolvedRoot_md) {
                return { isError: true, content: [{ type: "text", text: `flint_migrate_ds: newTokens path '${args.newTokens}' escapes projectRoot.` }] };
            }
            if (args.filePaths) {
                for (const fp of args.filePaths) {
                    const resolved = path.resolve(resolvedRoot_md, fp);
                    if (!resolved.startsWith(resolvedRoot_md + path.sep) && resolved !== resolvedRoot_md) {
                        return { isError: true, content: [{ type: "text", text: `flint_migrate_ds: filePath '${fp}' escapes projectRoot.` }] };
                    }
                }
            }
            if (!fs.existsSync(oldPath)) {
                return { isError: true, content: [{ type: "text", text: `flint_migrate_ds: old tokens file not found: ${oldPath}` }] };
            }
            if (!fs.existsSync(newPath)) {
                return { isError: true, content: [{ type: "text", text: `flint_migrate_ds: new tokens file not found: ${newPath}` }] };
            }
            const migPlan = computeTokenDiff(oldPath, newPath);
            const migFiles = (args.filePaths ?? []).map(fp => path.isAbsolute(fp) ? fp : path.join(args.projectRoot, fp));
            const migResults = migFiles.length > 0
                ? migrateDesignSystemFiles(migPlan, migFiles, { dryRun: args.dryRun !== false })
                : [];
            const migReport = generateMigrationReport(migPlan, migResults);
            return { content: [{ type: "text", text: migReport }] };
        }

        case "flint_universal_audit": {
            const uaArgs = request.params.arguments as {
                filePath: string;
                projectRoot: string;
                adapterOverride?: string;
                autoFix?: boolean;
            };
            return await handleUniversalAudit(uaArgs, flintConfig);
        }

        case "flint_enrich_registry": {
            const enrichArgs = request.params.arguments as {
                projectRoot: string;
                componentName?: string;
                overwrite?: boolean;
            };
            if (!enrichArgs.projectRoot || typeof enrichArgs.projectRoot !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_enrich_registry: 'projectRoot' parameter is required." }],
                };
            }
            const enrichResult = handleEnrichRegistry(enrichArgs);
            return {
                content: [{ type: "text", text: JSON.stringify(enrichResult, null, 2) }],
            };
        }

        case "flint_approve_enrichment": {
            const approveArgs = request.params.arguments as {
                projectRoot: string;
                componentName: string;
                action: "approve" | "dismiss";
                editedFields?: {
                    description?: string;
                    usageExample?: string;
                    compositionNotes?: string;
                    a11yNotes?: string;
                    relatedComponents?: string[];
                };
            };
            if (!approveArgs.projectRoot || typeof approveArgs.projectRoot !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_approve_enrichment: 'projectRoot' parameter is required." }],
                };
            }
            if (!approveArgs.componentName || typeof approveArgs.componentName !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_approve_enrichment: 'componentName' parameter is required." }],
                };
            }
            if (approveArgs.action !== "approve" && approveArgs.action !== "dismiss") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_approve_enrichment: 'action' must be 'approve' or 'dismiss'." }],
                };
            }
            const approveResult = handleApproveEnrichment(approveArgs);
            if (!approveResult.ok) {
                return {
                    isError: true,
                    content: [{ type: "text", text: approveResult.error ?? "flint_approve_enrichment: unknown error." }],
                };
            }
            return {
                content: [{ type: "text", text: JSON.stringify(approveResult, null, 2) }],
            };
        }

        case "flint_reindex_registry": {
            const reindexArgs = request.params.arguments as {
                projectRoot: string;
                srcDir?: string;
            };
            if (!reindexArgs.projectRoot || typeof reindexArgs.projectRoot !== "string") {
                return {
                    isError: true,
                    content: [{ type: "text", text: "flint_reindex_registry: 'projectRoot' parameter is required." }],
                };
            }
            const reindexResult = await handleReindexRegistry(reindexArgs);
            if (reindexResult.error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `flint_reindex_registry: ${reindexResult.error}` }],
                };
            }
            return {
                content: [{ type: "text", text: JSON.stringify(reindexResult, null, 2) }],
            };
        }

        default:
            throw new Error(`Unknown tool: ${request.params.name}`);
    }
});

function buildAtomicSyncPlan(intent: FlintSDIPayload): string {
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

    return `## ${BRAND.product} Execution Plan — Atomic Sync

**Component:** ${name} (Figma Node: ${sourceId})

**Strategy:** Locate the existing component by ${BRAND.dataIdAttr} or file name. Run MithrilLinter on applied tokens to detect drift. Apply token fixes and prop updates via ASTService.

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

function buildComposerPlan(intent: FlintSDIPayload): string {
    const { name, sourceId, layoutState, children = [] } = intent;

    const layoutRows = Object.entries(layoutState)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join('\n');

    const renderChild = (child: FlintSDIPayload, depth: number): string => {
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

    return `## ${BRAND.product} Execution Plan — Page Composer

**Page:** ${name} (Figma Node: ${sourceId})

**Strategy:** Match each child node to existing components in ${BRAND.registryDb}. Use injectComponent mutations to assemble the structural tree from the root outward.

### Page Layout

| Property | Value |
|----------|-------|
${layoutRows}

### Component Tree

${treeLines || '(no children)'}

### Recommended Assembly Mutations (via apply_ast_mutations)

${injectOps || '(no top-level children to inject)'}

### Next Step

1. Query ${BRAND.registryDb} for each component name to find its file path.
2. Call \`apply_ast_mutations\` with \`injectComponent\` ops to build the page structure.`;
}

function findProjectRoot(startPath: string): string | null {
    let curr = path.dirname(startPath);
    while (curr !== path.parse(curr).root) {
        if (fs.existsSync(path.join(curr, BRAND.configDir))) {
            return curr;
        }
        curr = path.dirname(curr);
    }
    return null;
}

/**
 * Listen for ingestion updates and notify MCP clients that resources have changed.
 */
flintEvents.on(EVENTS.TOKENS_UPDATED, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

flintEvents.on(EVENTS.INTENT_UPDATED, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

// Phase ACX.2 — context delta push triggers a resource-list change notification
// so polling MCP clients know to re-fetch flint://session-context.
flintEvents.on(EVENTS.CONTEXT_DELTA, () => {
    server.notification({
        method: "notifications/resources/list_changed",
    });
});

/**
 * Start the server.
 *
 * Project root resolution priority:
 *   1. --project-root <path> CLI argument
 *   2. FLINT_PROJECT_ROOT environment variable
 *   3. process.cwd() fallback
 */
export async function runServer() {
    const projectRoot = resolveProjectRoot();
    flintConfig = loadConfig(projectRoot);

    console.error(`${logTag()} Project root: ${projectRoot}`);
    console.error(`${logTag()} Active domains: ${flintConfig.domains.join(", ")}`);

    // Phase ACX.2 — start the event-driven context push manager.
    contextPushManager.start(projectRoot);
    console.error(`${logTag()} ContextPushManager started`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`${BRAND.product} MCP Server listening on stdio`);

    // Clean up on graceful shutdown.
    const shutdown = () => {
        contextPushManager.stop();
        process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}

// Auto-run when invoked as a script (not when imported by tests)
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runServer().catch((err) => {
        console.error(`${logTag()} Fatal startup error: ${err}`);
        process.exit(1);
    });
}
