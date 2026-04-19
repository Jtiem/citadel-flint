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
import { auditAll, auditAllWithSurface } from "./core/MithrilLinter.js";
import { A11yLinter, auditWithSurface } from "./core/A11yLinter.js";
// ── FIXTURE.1 imports (append-only) ──────────────────────────────────────────
import { resolveFixture } from "./core/fixtureResolver.js";
import type { FlintFixtureSurface } from "../../shared/fixture-schema.js";
// ── FIXTURE.1.1 import (append-only) ─────────────────────────────────────────
import { normalizeTokenShape } from "./core/dtcgTokenAdapter.js";
import { HydroPasteEngine } from "./core/hydroPaste.js";
import { moveNode, injectComponent, applyTokenFix, assembleLayout, deleteNode, updateProp, updateClassName, updateTextContent, wrapNode, emitImport, emitHook, emitHandler, emitCallback, emitConditional, emitMap, composeSlot } from "./core/ast-modifier.js";
import { TelemetryLogger } from "./core/telemetry.js";
import { formatMutationReceipt, formatAuditReport } from "./core/formatters.js";
import { queryRegistry, formatShadowStorybook } from "./core/registryService.js";
import { queryRAGRegistry } from "./core/ragRegistryService.js";
import type { DesignToken, LinterWarning, FlintSDIPayload } from "./types.js";
import { flintEvents, EVENTS } from "./core/events.js";
import { resolveProjectRoot, loadConfig, loadProjectConfig } from "./core/config-loader.js";
import { DEFAULT_CONFIG } from "./core/config.js";
import type { FlintConfig } from "./core/config.js";
import {
    loadAndResolvePolicy,
    writeResolvedPolicy,
    mergeAndValidatePolicy,
    getDefaultResolvedPolicy,
    getRuleMode,
} from "./core/policyEngine.js";
import type { RawPolicy, ResolvedPolicy } from "./core/policyEngine.js";
import { validateToolInput, ToolInputValidationError } from "./tools/schemas.js";
import { findPackForRule, getActivePackIds } from "./core/rulePackRegistry.js";
import { getErrorEntryByRuleId } from "./core/errorTaxonomy.js";
import type { ResolvedToolContext } from "./tools/handlers/types.js";
import { handleSetPolicy } from "./tools/handlers/setPolicy.handler.js";
import { handleAudit } from "./tools/handlers/audit.handler.js";
import { handleFix } from "./tools/handlers/fix.handler.js";
import { handleMigrateTw } from "./tools/handlers/migrateTw.handler.js";
import { handleAgentTrust } from "./tools/handlers/agentTrust.handler.js";
import { handleFlintAudit, handleFlintAuditBatch, FLINT_AUDIT_TOOL } from "./tools/audit.js";
import { handleFlintFix, FLINT_FIX_TOOL } from "./tools/fix.js";
import { handleFlintSwarmAuditFix, FLINT_SWARM_AUDIT_FIX_TOOL } from "./tools/swarm.js";
import { handleFlintIngest, FLINT_INGEST_TOOL } from "./tools/ingest.js";
import { handleFlintSync, FLINT_SYNC_TOOL } from "./tools/sync.js";
import { handleAuditReport, FLINT_AUDIT_REPORT_TOOL } from "./tools/auditReport.js";
import { FLINT_SENTINEL_PROMPT_DEF, getFlintSentinelContent } from "./prompts/sentinel.js";
import { QUICK_AUDIT_PROMPT_DEF, getQuickAuditContent } from "./prompts/quickAudit.js";
import { FIX_ALL_PROMPT_DEF, getFixAllContent } from "./prompts/fixAll.js";
import { ONBOARD_PROJECT_PROMPT_DEF, getOnboardProjectContent } from "./prompts/onboard-project.js";
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
import { ConsensusQueryService } from "./core/governance/consensusQueryService.js";
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
import { handleDeferViolation, FLINT_DEFER_VIOLATION_TOOL } from "./tools/deferViolation.js";
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
import {
    handleEmitTokens,
    FLINT_EMIT_TOKENS_TOOL,
} from "./tools/emitTokens.js";
import {
    handleMapTokens,
    FLINT_MAP_TOKENS_TOOL,
} from "./tools/mapTokens.js";
import {
    handleSetLibrary,
    FLINT_SET_LIBRARY_TOOL,
} from "./tools/setLibrary.js";
import {
    handlePackExport,
    FLINT_PACK_EXPORT_TOOL,
} from "./tools/packExport.js";
import {
    handlePackImport,
    handlePackRollback,
    FLINT_PACK_IMPORT_TOOL,
    FLINT_PACK_ROLLBACK_TOOL,
} from "./tools/packImport.js";
import {
    handleDesignToCode,
    FLINT_DESIGN_TO_CODE_TOOL,
} from "./tools/designToCode.js";
import {
    handleExtractTokens,
    handleApproveTokens,
    FLINT_EXTRACT_TOKENS_TOOL,
    FLINT_APPROVE_TOKENS_TOOL,
} from "./tools/extractTokens.js";
import {
    handleCodeConnectSync,
    FLINT_CODE_CONNECT_SYNC_TOOL,
} from "./tools/codeConnectSync.js";
import {
    handlePullVariables,
    FLINT_PULL_VARIABLES_TOOL,
} from "./tools/figmaVariables.js";
import {
    handleFlintQuickstart,
    FLINT_QUICKSTART_TOOL,
} from "./tools/quickstart.js";
import {
    handleListRulePacks,
    handleEnablePack,
    handleDisablePack,
    handleSetRuleMode,
    handleComplianceCoverage,
    FLINT_LIST_RULE_PACKS_TOOL,
    FLINT_ENABLE_PACK_TOOL,
    FLINT_DISABLE_PACK_TOOL,
    FLINT_SET_RULE_MODE_TOOL,
    FLINT_COMPLIANCE_COVERAGE_TOOL,
} from "./tools/rulePacks.js";
import { toolError, HINTS } from "./core/errorResponse.js";
import { DriftTrendService } from "./core/governance/driftTrendService.js";
import type { DriftTrend } from "./core/governance/driftTrendService.js";

// @ts-ignore
const generate = _generate.default || _generate;

// ---------------------------------------------------------------------------
// Provenance singleton — one MutationProvenanceService per project root,
// backed by a file-based SQLite database at <root>/.flint/provenance.db
// ---------------------------------------------------------------------------

const _provenanceServices = new Map<string, MutationProvenanceService>();

export function getProvenanceService(projectRoot: string): MutationProvenanceService {
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

export function getOverrideTelemetryService(projectRoot: string): OverrideTelemetryService {
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

export function getTrustTierService(projectRoot: string): TrustTierService {
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
// Drift Trend singleton — P3.5: one DriftTrendService per project root,
// backed by the governance.db (shares schema with GovernanceEventService +
// MutationLedgerService). Reads governance_events + mutations_ledger tables.
// ---------------------------------------------------------------------------

const _driftTrendServices = new Map<string, DriftTrendService>();

function getDriftTrendService(projectRoot: string): DriftTrendService {
    const existing = _driftTrendServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "governance.db"));
    const service = new DriftTrendService(db);
    _driftTrendServices.set(projectRoot, service);
    return service;
}

// ---------------------------------------------------------------------------
// Consensus Query singleton — V.4: one ConsensusQueryService per project root,
// backed by a file-based SQLite database at <root>/.flint/consensus.db
// ---------------------------------------------------------------------------

const _consensusServices = new Map<string, ConsensusQueryService>();

function getConsensusQueryService(projectRoot: string): ConsensusQueryService {
    const existing = _consensusServices.get(projectRoot);
    if (existing !== undefined) return existing;

    const dbDir = path.join(projectRoot, BRAND.configDir);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new BetterSqlite3(path.join(dbDir, "consensus.db"));
    const service = new ConsensusQueryService(db);
    _consensusServices.set(projectRoot, service);
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

// ---------------------------------------------------------------------------
// Strategy 1: The Greeter — context-aware welcome message
// ---------------------------------------------------------------------------

/**
 * Detect whether the user has an existing project context (returning user).
 * Returns true when `.flint/context.json` exists and contains a non-empty
 * `healthGrade` string — indicating a prior governance session.
 */
export function detectReturningUser(projectRoot: string): boolean {
    try {
        const contextPath = path.join(projectRoot, BRAND.configDir, "context.json");
        if (fs.existsSync(contextPath)) {
            const raw = fs.readFileSync(contextPath, "utf-8");
            const ctx = JSON.parse(raw);
            // healthGrade must be a non-empty string (e.g. "A", "B", "C", "D", "F")
            return typeof ctx?.healthGrade === "string" && ctx.healthGrade.length > 0;
        }
    } catch { /* fall through */ }
    return false;
}

/**
 * Count the number of registered tools by scanning this file's ListToolsRequestSchema handler.
 * Returns a reasonable static count derived from the CLAUDE.md tool table (54 registered).
 * This is intentionally static — the count is known at build time and avoids circular deps.
 */
const REGISTERED_TOOL_COUNT = 59;

/**
 * Build the MCP server instructions string.
 * These are for the MODEL, not the user. They tell the model WHEN to use Flint tools.
 * Claude Code caps instructions at 2KB — stay under 1800 chars.
 *
 * Called once in `runServer()` after the project root is known.
 */
export function buildGreeting(projectRoot: string): string {
    const isReturning = detectReturningUser(projectRoot);

    const TRIGGER_WORDS =
        "When the user mentions: audit, accessibility, WCAG, design tokens, violations, " +
        "governance, brand compliance, export gate, design debt, Figma import, design system " +
        "migration, Tailwind, component health, or linter -- use Flint tools.";

    const KEY_TOOLS =
        "Key tools: " +
        `${toolName("get_context")} (project state, call first), ` +
        "audit_ui_component (audit a file by path), " +
        `${toolName("fix")} (auto-fix violations), ` +
        `${toolName("debt_report")} (health score 0-100, A-F grade), ` +
        `${toolName("plan")} (structured execution plans).`;

    const CATALOG_REF =
        `Full tool catalog: ${resourceUri("capabilities")}. ` +
        `Guided workflows: use the ${BRAND.productLower}-workflow-guide prompt.`;

    if (isReturning) {
        // Read healthGrade from context for personalised returning-user message
        let grade = "";
        let topViolation = "";
        try {
            const contextPath = path.join(projectRoot, BRAND.configDir, "context.json");
            if (fs.existsSync(contextPath)) {
                const ctx = JSON.parse(fs.readFileSync(contextPath, "utf-8"));
                grade = typeof ctx?.healthGrade === "string" ? ctx.healthGrade : "";
                if (Array.isArray(ctx?.violations) && ctx.violations.length > 0) {
                    const top = ctx.violations[0];
                    topViolation = typeof top?.ruleId === "string"
                        ? `Top violation: ${top.ruleId}.`
                        : "";
                }
            }
        } catch { /* fall through */ }

        const gradeStr = grade ? `Grade: ${grade}.` : "";
        const violationStr = topViolation ? ` ${topViolation}` : "";

        return [
            `${BRAND.product} is connected. ${gradeStr}${violationStr}`.trim(),
            `Read ${resourceUri("session-context")} for current project state.`,
            "Say 'audit' to scan, 'fix' to auto-remediate, or 'debt report' for trends.",
            TRIGGER_WORDS,
            KEY_TOOLS,
            CATALOG_REF,
        ].join("\n\n");
    }

    return [
        `${BRAND.product} is connected. ${REGISTERED_TOOL_COUNT} governance tools ready.`,
        `Quick start:\n` +
        `- 'audit my component' — scan a file for violations\n` +
        `- 'fix it' — auto-remediate detected violations\n` +
        `- 'check accessibility' — WCAG 2.1 AA compliance\n` +
        `- 'show health' — design debt score and grade\n` +
        `- 'what can you do?' — full capability tour`,
        TRIGGER_WORDS,
        KEY_TOOLS,
        CATALOG_REF,
    ].join("\n\n");
}

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
        // Default instructions — replaced in runServer() with context-aware greeting.
        // This static version is used when the server starts before projectRoot is known.
        instructions:
            `${BRAND.product} is connected. ${REGISTERED_TOOL_COUNT} governance tools ready. ` +
            `When the user mentions: audit, accessibility, WCAG, design tokens, violations, ` +
            `governance, brand compliance, export gate, design debt, Figma import, design system ` +
            `migration, Tailwind, component health, or linter -- use Flint tools. ` +
            `Key tools: ${toolName("get_context")} (call first), audit_ui_component, ` +
            `${toolName("fix")}, ${toolName("debt_report")}, ${toolName("plan")}. ` +
            `Full catalog: ${resourceUri("capabilities")}.`,
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
                description: "Convert a Figma design payload into React component code snippets.",
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
                description: "Make code changes safely — move elements, inject components, fix tokens, update props, and more. This is the only approved way to modify code.",
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
                description: "Find existing components in your design system. Returns matching components with TypeScript interfaces and import paths.",
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
            FLINT_QUICKSTART_TOOL,
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
                description: "See who changed each piece of code and why — track human edits, auto-fixes, imports, and AI agent actions.",
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
                description: "See which governance rules have been bypassed or turned down, and by whom. Useful for compliance reviews.",
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
                description: "Check an AI agent's safety track record — how many changes it made, its risk score, and whether it has been flagged.",
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
                description: "Spot unusual patterns — spikes in overrides, sudden violation surges, or agents behaving differently than normal.",
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
                name: toolName("drift_trend"),
                description: "Show how design system compliance is trending — weekly violations, self-healing fix rate, repeat offender files, and adoption score. Triggers alerts when metrics regress.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: {
                            type: "string",
                            description: "Absolute path to the project root (must contain a .flint directory).",
                        },
                        windowDays: {
                            type: "number",
                            description: "Number of past days to include in the trend (default: 30).",
                        },
                        repeatOffenderThreshold: {
                            type: "number",
                            description: "Minimum mutation count for a file to be flagged as a repeat offender (default: 3).",
                        },
                        spikeAlertPercent: {
                            type: "number",
                            description: "Week-over-week violation increase percentage that triggers a spike alert (default: 40).",
                        },
                    },
                    required: ["projectRoot"],
                },
            },
            {
                name: toolName("consensus_report"),
                description:
                    "Check whether AI agents are agreeing or disagreeing on code safety. High disagreement means something needs human review.",
                inputSchema: {
                    type: "object",
                    properties: {
                        mode: {
                            type: "string",
                            enum: ["summary", "by_session", "by_agent", "disagreements"],
                            description:
                                '"summary" returns aggregate stats. "by_session" filters by sessionId. ' +
                                '"by_agent" filters by agentId. "disagreements" returns only disagreement records.',
                        },
                        sessionId: {
                            type: "string",
                            description: "Session UUID to filter by (only for by_session mode).",
                        },
                        agentId: {
                            type: "string",
                            description: "Agent ID to filter by (only for by_agent mode).",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of records to return (default 20, max 100).",
                        },
                    },
                    required: ["mode"],
                },
            },
            {
                name: toolName("risk_score"),
                description: "Check how risky a code change is (0-100 score). Can score a single change, a file, or the whole project.",
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
                    "Migrate Tailwind CSS v3 utility classes to v4 equivalents via AST transformation. " +
                    "Covers all deprecated v3 utilities (flex-grow, overflow-ellipsis, bg-gradient, etc.). " +
                    "Runs flint_audit on changed files after migration. Dry-run by default.",
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
                name: toolName("migrate_config"),
                description:
                    "Migrate legacy JSON config files into a unified flint.config.yaml. " +
                    "Optionally backs up legacy files to *.bak. Dry-run by default.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project name for the config. Defaults to the directory name.",
                        },
                        backup: {
                            type: "boolean",
                            description: "When true (default), rename legacy JSON files to *.bak after migration.",
                        },
                        dry_run: {
                            type: "boolean",
                            description: "When true (default), preview the YAML without writing. Set false to write.",
                        },
                    },
                },
            },
            {
                name: toolName("agent_trust"),
                description: "Query and manage agent trust levels. Agents earn/lose tiers based on behavioral history. Actions: 'profile', 'list', 'promote', 'demote', 'reset'.",
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
                description: "Manage Figma file connections for bidirectional token sync. Actions: 'connect', 'disconnect', 'status'.",
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
                description: "Pull remote Figma variable changes into local design-tokens.json. Auto-applies added/modified tokens; creates conflicts for tokens changed in both.",
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
                description: "Push local design-token changes to the connected Figma file.",
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
                description: "Resolve a single pending token sync conflict by choosing 'local', 'remote', or 'merged'.",
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
                description: "Bulk-resolve all pending token sync conflicts for a project. Resolution must be 'local' or 'remote'.",
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
                description: "CI/CD sync health check. Reports token sync status with Figma baseline, conflicts, staleness, drift, and a recommendation.",
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
                description: "Export sync history for a project as JSON or CSV.",
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
                description: "Validate a codebase against multiple brand/theme token sets. Returns a cross-theme compliance matrix.",
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
                description: "Migrate between design system versions. Compares two token files and updates all consuming components. Returns a per-file migration report with warnings.",
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
            FLINT_EMIT_TOKENS_TOOL,
            FLINT_MAP_TOKENS_TOOL,
            FLINT_SET_LIBRARY_TOOL,
            FLINT_DESIGN_TO_CODE_TOOL,
            FLINT_EXTRACT_TOKENS_TOOL,
            FLINT_APPROVE_TOKENS_TOOL,
            FLINT_CODE_CONNECT_SYNC_TOOL,
            FLINT_PULL_VARIABLES_TOOL,
            FLINT_PACK_EXPORT_TOOL,
            FLINT_PACK_IMPORT_TOOL,
            FLINT_PACK_ROLLBACK_TOOL,
            FLINT_DEFER_VIOLATION_TOOL,
            FLINT_LIST_RULE_PACKS_TOOL,
            FLINT_ENABLE_PACK_TOOL,
            FLINT_DISABLE_PACK_TOOL,
            FLINT_SET_RULE_MODE_TOOL,
            FLINT_COMPLIANCE_COVERAGE_TOOL,
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
                description: "Override telemetry summary — total count, overrides by rule, by session, last 24h count, and last override timestamp."
            },
            {
                uri: resourceUri("agent-risk"),
                name: BRAND.product + " Agent Risk Dashboard",
                mimeType: "application/json",
                description: "Per-agent risk profiles — mutation counts, average risk scores, red/amber/green tier breakdown, override counts."
            },
            {
                uri: resourceUri("anomalies"),
                name: BRAND.product + " Anomaly Detection",
                mimeType: "application/json",
                description: "Current anomaly count and latest detected anomalies from statistical baseline analysis."
            },
            {
                uri: resourceUri("governance/trends"),
                name: BRAND.product + " Governance Trends",
                mimeType: "application/json",
                description: "Drift trending — weekly violation counts, fix rate, repeat offender files, adoption score, and alerts. Configurable window (default: 30 days)."
            },
            {
                uri: resourceUri("figma-connection"),
                name: BRAND.product + " Figma Connection",
                mimeType: "application/json",
                description: "Current Figma file connection status, file key, last sync timestamp."
            }
        ]
    };
});

/**
 * Read a specific resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const projectRoot = resolveProjectRoot();

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
            throw new Error(`Design tokens file not found: ${path.basename(tokensPath)}`);
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
            throw new Error(`Manifest file not found: ${path.basename(manifestPath)}`);
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
        // Sprint 4 D6 — enrich each rule with ruleMode, sourceAuthority, pack.
        const rulesResolved = loadAndResolvePolicy(projectRoot);
        const allRules: Record<string, unknown> = {};
        for (const domainId of domainRegistry.list()) {
            const domain = domainRegistry.get(domainId);
            if (!domain) continue;
            if (fs.existsSync(domain.rulesPath)) {
                try {
                    const rules = await loadRulesFromDirectory(domain.rulesPath);
                    allRules[domainId] = rules.map((rule) => {
                        const ruleId = (rule as { id?: string }).id ?? '';
                        const ruleMode = ruleId
                            ? getRuleMode(ruleId, rulesResolved)
                            : 'normative';
                        const taxonomyEntry = ruleId ? getErrorEntryByRuleId(ruleId) : null;
                        const pack = ruleId ? findPackForRule(ruleId) : null;
                        return {
                            ...(rule as object),
                            ruleMode,
                            sourceAuthority: taxonomyEntry?.sourceAuthority ?? null,
                            pack: pack?.id ?? null,
                        };
                    });
                } catch {
                    allRules[domainId] = [];
                }
            } else {
                allRules[domainId] = [];
            }
        }
        // Top-level packs section listing active packs for this project.
        let activePacks: string[] = [];
        try {
            activePacks = getActivePackIds(projectRoot);
        } catch {
            activePacks = [];
        }
        const body = {
            ...allRules,
            packs: activePacks,
        };
        void rulesResolved; // kept in scope for per-rule enrichment above
        return {
            contents: [{
                uri: resourceUri("rules"),
                mimeType: "application/json",
                text: JSON.stringify(body, null, 2),
            }]
        };
    }

    if (request.params.uri === resourceUri("dashboard")) {
        const dashboard = generateDashboard(projectRoot);
        const dbGrade = dashboard.grade ?? "?";
        const dbScore = dashboard.healthScore ?? 0;
        const dbTrend = dashboard.history.length >= 2
            ? (dashboard.history[0].healthScore > dashboard.history[1].healthScore ? "improving" : dashboard.history[0].healthScore < dashboard.history[1].healthScore ? "declining" : "stable")
            : "stable";
        const dbSummary = `Health: ${dbGrade} (${dbScore}/100) | Trend: ${dbTrend}`;
        return {
            contents: [{
                uri: resourceUri("dashboard"),
                mimeType: "application/json",
                text: `${dbSummary}\n\n${JSON.stringify(dashboard, null, 2)}`,
            }]
        };
    }

    if (request.params.uri === resourceUri("policy")) {
        const policy = loadAndResolvePolicy(projectRoot);
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
        const scGrade = sessionCtx.healthGrade ?? "?";
        const scScore = sessionCtx.healthScore ?? 0;
        const scViolationCount = (sessionCtx.violations?.mithrilCount ?? 0) + (sessionCtx.violations?.a11yCount ?? 0);
        const scActiveFile = sessionCtx.activeFilePath ?? "none";
        const scSummary = `Project: ${path.basename(projectRoot)} | Health: ${scGrade} (${scScore}/100) | ${scViolationCount} violations | Active: ${scActiveFile}`;
        return {
            contents: [{
                uri: resourceUri("session-context"),
                mimeType: "application/json",
                text: `${scSummary}\n\n${JSON.stringify(sessionCtx, null, 2)}`,
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
            const arAgents = summary.agents ?? [];
            const arRedCount = arAgents.filter(a => a.redCount > 0).length;
            const arSummary = `${arAgents.length} agents tracked | ${arRedCount} red flag${arRedCount !== 1 ? "s" : ""}`;
            return {
                contents: [{
                    uri: resourceUri("agent-risk"),
                    mimeType: "application/json",
                    text: `${arSummary}\n\n${JSON.stringify(summary, null, 2)}`,
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("agent-risk"),
                    mimeType: "application/json",
                    text: `0 agents tracked | 0 red flags\n\n${JSON.stringify({ agents: [], topRiskiest: [], period: "last_7_days" }, null, 2)}`,
                }]
            };
        }
    }

    if (request.params.uri === resourceUri("anomalies")) {
        try {
            const svc = getAnomalyDetectionService(projectRoot);
            const history = svc.getAnomalyHistory(projectRoot, 10);
            const anomalyData = { count: history.length, anomalies: history };
            const anomalySummary = history.length > 0
                ? `${history.length} anomal${history.length !== 1 ? "ies" : "y"} detected`
                : "No anomalies — all clear.";
            return {
                contents: [{
                    uri: resourceUri("anomalies"),
                    mimeType: "application/json",
                    text: `${anomalySummary}\n\n${JSON.stringify(anomalyData, null, 2)}`,
                }]
            };
        } catch {
            return {
                contents: [{
                    uri: resourceUri("anomalies"),
                    mimeType: "application/json",
                    text: `No anomalies — all clear.\n\n${JSON.stringify({ count: 0, anomalies: [] }, null, 2)}`,
                }]
            };
        }
    }

    if (request.params.uri === resourceUri("governance/trends")) {
        try {
            const svc = getDriftTrendService(projectRoot);
            const trend = svc.computeTrend(30);
            const totalViolations = trend.weeklyViolations.reduce((sum, w) => sum + w.total, 0);
            const trendSummary = totalViolations > 0
                ? `${totalViolations} violations over ${trend.weeklyViolations.length} weeks | Fix rate: ${trend.fixRate.percentage}% | ${trend.repeatOffenders.length} repeat offender(s) | ${trend.alerts.length} alert(s)`
                : "No violations in the last 30 days.";
            return {
                contents: [{
                    uri: resourceUri("governance/trends"),
                    mimeType: "application/json",
                    text: `${trendSummary}\n\n${JSON.stringify(trend, null, 2)}`,
                }]
            };
        } catch {
            const emptyTrend: DriftTrend = {
                window: { start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString(), days: 30 },
                weeklyViolations: [],
                fixRate: { autoFixed: 0, total: 0, percentage: 0 },
                repeatOffenders: [],
                alerts: [],
            };
            return {
                contents: [{
                    uri: resourceUri("governance/trends"),
                    mimeType: "application/json",
                    text: `No violations in the last 30 days.\n\n${JSON.stringify(emptyTrend, null, 2)}`,
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
        // Sprint 4 D7 — platform-aware URI parser with sandbox to projectRoot.
        const filePath = parseViolationsUri(request.params.uri, projectRoot);
        if (!filePath) {
            throw new Error(
                `Invalid flint://violations path — must resolve inside projectRoot (${projectRoot}).`,
            );
        }
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${path.basename(filePath)}`);
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
            QUICK_AUDIT_PROMPT_DEF,
            FIX_ALL_PROMPT_DEF,
            ONBOARD_PROJECT_PROMPT_DEF,
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

    if (request.params.name === BRAND.productLower + "-quick-audit") {
        const filePath = (request.params.arguments as Record<string, string> | undefined)?.filePath;
        return {
            description: BRAND.product + " single-file governance audit",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getQuickAuditContent(filePath),
                    },
                }
            ]
        };
    }

    if (request.params.name === BRAND.productLower + "-fix-all") {
        const filePath = (request.params.arguments as Record<string, string> | undefined)?.filePath;
        return {
            description: BRAND.product + " auto-fix all governance violations",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getFixAllContent(filePath),
                    },
                }
            ]
        };
    }

    if (request.params.name === BRAND.productLower + "-onboard-project") {
        const projectRoot = (request.params.arguments as Record<string, string> | undefined)?.projectRoot;
        return {
            description: BRAND.product + " first-time project setup — index components, baseline health score, next steps",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: getOnboardProjectContent(projectRoot),
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
    // Sprint 4 D1 — Zod validation hoist.
    // Validate request.params.arguments against the per-tool Zod schema
    // registered in tools/schemas.ts. Unknown tools (schema-less) fall
    // through untouched; validation errors return a structured envelope.
    try {
        request.params.arguments = validateToolInput(
            request.params.name,
            request.params.arguments ?? {},
        ) as Record<string, unknown>;
    } catch (err) {
        if (err instanceof ToolInputValidationError) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        code: "invalid_input",
                        tool: err.toolName,
                        message: err.message,
                        issues: err.issues,
                    }, null, 2),
                }],
            };
        }
        throw err;
    }
    // Sprint 4 D8 — hoist projectRoot once per tool call so every handler
    // and every `process.cwd()` consumer inside the switch reads the same
    // value. `resolveProjectRoot()` walks up from cwd for a `.flint/`
    // directory and falls back to cwd if none is found.
    const projectRoot: string = resolveProjectRoot();
    // Sprint 4 D3 — hoist ResolvedPolicy once per tool call so per-rule
    // modes set via `flint_set_policy` are reflected on the very next
    // call without requiring a server restart.
    const resolved: ResolvedPolicy = loadAndResolvePolicy(projectRoot);
    // Sprint 4 D2 — shared context for extracted handlers. Handlers that
    // need to trigger a server-level FlintConfig reload (e.g.
    // flint_set_policy) do so via ctx.reloadFlintConfig(), keeping the
    // module-level `flintConfig` variable authoritative.
    const toolCtx: ResolvedToolContext = {
        projectRoot,
        flintConfig,
        resolved,
        reloadFlintConfig: () => {
            flintConfig = loadConfig(projectRoot);
            return flintConfig;
        },
    };
    void toolCtx; // used by extracted handler cases
    switch (request.params.name) {
        case "flint_get_context": {
            const { projectRoot: ctxRoot } = request.params.arguments as { projectRoot: string };
            if (!ctxRoot || typeof ctxRoot !== "string") {
                return toolError("flint_get_context", new Error("'projectRoot' parameter is required."), {
                    causes: ["The projectRoot parameter was not provided"],
                    recovery: ["Pass the absolute path to your project root directory"],
                });
            }
            const sessionCtx = await assembleSessionContext(ctxRoot);
            // Build plain-English summary line before the JSON
            const ctxGrade = sessionCtx.healthGrade ?? "?";
            const ctxScore = sessionCtx.healthScore ?? 0;
            const ctxViolationCount = (sessionCtx.violations?.mithrilCount ?? 0) + (sessionCtx.violations?.a11yCount ?? 0);
            const ctxActiveFile = sessionCtx.activeFilePath ?? "none";
            const ctxSummary = `Project: ${path.basename(ctxRoot)} | Health: ${ctxGrade} (${ctxScore}/100) | ${ctxViolationCount} violations | Active: ${ctxActiveFile}`;
            return {
                content: [{
                    type: "text",
                    text: `${ctxSummary}\n\n${JSON.stringify(sessionCtx, null, 2)}`,
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
                return toolError("flint_assess_complexity", new Error("'taskDescription' parameter is required."), HINTS.missingParam("flint_assess_complexity taskDescription='Migrate all buttons to use design tokens'"));
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
                        text: [
                            `${BRAND.product} governance engine active — ${REGISTERED_TOOL_COUNT} tools ready.`,
                            "",
                            "Quick start:",
                            "• 'audit my component' — scan a file for violations",
                            "• 'fix it' — auto-remediate detected violations",
                            "• 'check accessibility' — WCAG 2.1 AA compliance",
                            "• 'show health' — design debt score and grade",
                            "• 'what can you do?' — full capability tour",
                            "",
                            "New here? Say 'onboard my project' to get set up.",
                        ].join("\n"),
                    },
                ],
            }, 'cached', 0, 1.0);
        }

        case "audit_ui_component": {
            const finishAudit = startResponseTimer('ast');
            const _auditArgs = request.params.arguments as { file?: string; componentPath?: string };
            const file = _auditArgs.file ?? _auditArgs.componentPath;
            const componentPath = file && path.isAbsolute(file) ? file : path.resolve(projectRoot, file ?? '');

            if (!fs.existsSync(componentPath)) {
                console.error(`[audit_ui_component] File not found: ${componentPath}`);
                return toolError("audit_ui_component", new Error(`File not found: ${path.basename(componentPath)}`), HINTS.fileNotFound);
            }

            const code = fs.readFileSync(componentPath, "utf-8");

            const componentProjectRoot = findProjectRoot(componentPath);
            if (!componentProjectRoot) {
                return toolError("audit_ui_component", new Error(`Could not find project root (${BRAND.configDir} directory)`), HINTS.fileNotFound);
            }
            const telemetry = new TelemetryLogger(componentProjectRoot);

            const tokensPath = path.join(componentProjectRoot, configPath("design-tokens.json"));
            let tokens: DesignToken[] = [];
            const auditWarnings: string[] = [];

            if (fs.existsSync(tokensPath)) {
                try {
                    const rawTokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
                    tokens = Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens);
                } catch (e) {
                    console.error("Failed to parse design-tokens.json", e);
                    auditWarnings.push("Token file couldn't be read — token coverage skipped. Check .flint/design-tokens.json.");
                }
            }

            try {
                const ast = parse(code, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                });

                // CR-SEAL: Load component registry for REG-001 audit
                // ARM.1 fix: prefer .flint/flint-manifest.json (where setLibrary writes),
                // fall back to project-root flint-manifest.json (legacy resolver format).
                let auditRegistry: Record<string, { importPath?: string; [key: string]: unknown }> | undefined
                const scopedManifestPath = path.join(componentProjectRoot, configPath(BRAND.manifestFile))
                const rootManifestPath = path.join(componentProjectRoot, BRAND.manifestFile)
                const manifestPath = fs.existsSync(scopedManifestPath) ? scopedManifestPath : rootManifestPath
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
                        const components = manifestRaw.components ?? manifestRaw
                        if (components && typeof components === 'object' && Object.keys(components).length > 0) {
                            // `components` may be a keyed object (legacy) or an array (ARM.1).
                            // Normalize to a keyed map so linter lookups by name succeed.
                            if (Array.isArray(components)) {
                                auditRegistry = {}
                                for (const c of components) {
                                    if (c && typeof c.name === 'string') {
                                        auditRegistry[c.name] = c
                                    }
                                }
                            } else {
                                auditRegistry = components
                            }
                        }
                        // ARM.1: Merge library-seeded components into the registry.
                        // Local entries always win if a name collision exists.
                        if (Array.isArray(manifestRaw.libraryComponents)) {
                            if (!auditRegistry) auditRegistry = {}
                            for (const lc of manifestRaw.libraryComponents) {
                                if (lc.name && typeof lc.name === 'string' && !auditRegistry[lc.name]) {
                                    auditRegistry[lc.name] = lc
                                }
                            }
                        }
                    } catch {
                        auditWarnings.push("Component registry unavailable — registry membership check skipped. Run flint_reindex_registry to rebuild.");
                    }
                }

                // ── FIXTURE.1: resolve per-directory audit context ──────────
                let fixtureContext: { label?: string; source: string | null } | null = null;
                let fixtureSurface: FlintFixtureSurface | undefined;
                try {
                    const resolvedFixture = resolveFixture(componentPath, componentProjectRoot);
                    if (resolvedFixture.source !== null) {
                        fixtureContext = { label: resolvedFixture.fixture.label, source: resolvedFixture.source };
                    } else {
                        fixtureContext = null;
                    }
                    fixtureSurface = resolvedFixture.fixture.surface;
                    // Override tokens from fixture-declared path if it resolves successfully
                    if (resolvedFixture.resolvedTokensPath && resolvedFixture.resolvedTokensPath !== tokensPath) {
                        try {
                            const rawFixtureTokens = JSON.parse(fs.readFileSync(resolvedFixture.resolvedTokensPath, "utf-8"));
                            tokens = normalizeTokenShape(rawFixtureTokens).tokens;
                        } catch {
                            auditWarnings.push(`Fixture tokens file could not be read — using project default tokens.`);
                        }
                    }
                } catch (fixtureErr: any) {
                    auditWarnings.push(`Fixture resolution failed: ${fixtureErr?.message ?? 'unknown error'}`);
                }
                // ── end FIXTURE.1 ────────────────────────────────────────────

                const policyOpts = {
                    deltaE_threshold: resolved.mithril.deltaE_threshold,
                    deltaE_critical_threshold: resolved.mithril.deltaE_critical_threshold,
                    ...(auditRegistry && { registry: auditRegistry }),
                };
                const mithrilWarnings = resolved.mithril.mode !== 'off'
                    ? auditAllWithSurface(ast as any, tokens, fixtureSurface, policyOpts)
                    : new Map();
                const a11yResult = resolved.a11y.mode !== 'off'
                    ? auditWithSurface(ast as any, componentPath, fixtureSurface)
                    : { filePath: componentPath, totalRules: 0, passed: 0, failed: 0, compliancePercent: 100, violations: [], criterionResults: [], fixableCount: 0, timestamp: new Date().toISOString() } as any;

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

                // CLARITY: Generate recommendation for audit_ui_component
                let auditRecommendation: string;
                if (hasViolations) {
                    const fixNote = totalFixableCount > 0 ? ` (${totalFixableCount} auto-fixable)` : '';
                    auditRecommendation = `${totalViolationCount} issue${totalViolationCount !== 1 ? 's' : ''} found${fixNote}. Say 'fix it' to auto-remediate.`;
                } else {
                    auditRecommendation = 'Clean audit — this component is fully compliant.';
                }

                const warningNote = auditWarnings.length > 0
                    ? `\n\nWarnings:\n${auditWarnings.map(w => `• ${w}`).join("\n")}`
                    : "";
                // FIXTURE.1: include fixture context in response (null-safe)
                const fixtureNote = fixtureContext
                    ? `\n\nAudit context: ${fixtureContext.label ?? path.basename(fixtureContext.source ?? 'fixture')} (${fixtureSurface ?? 'component'} surface)`
                    : "";
                return finishAudit({
                    content: [
                        { type: "text", text: `${finalSummary}\n\nRecommendation: ${auditRecommendation}\n\n${finalFormatted}${warningNote}${fixtureNote}` },
                    ],
                });
            } catch (err: any) {
                telemetry.log({
                    tool: "audit_ui_component",
                    input_summary: `Auditing ${path.basename(componentPath)}`,
                    outcome: `Blocked: Parsing Error ${err.message}`,
                    metadata: JSON.stringify({ error: err.message })
                });

                return toolError("audit_ui_component", err, HINTS.parseError);
            }
        }

        case "hydrate_figma_data": {
            const { figmaPayload, projectRoot } = request.params.arguments as { figmaPayload: string; projectRoot: string };

            if (!fs.existsSync(projectRoot)) {
                return toolError("hydrate_figma_data", new Error(`Project root not found: ${path.basename(projectRoot)}`), HINTS.fileNotFound);
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
                console.error(`[flint_ast_mutate] File not found: ${targetPath}`);
                return toolError("flint_ast_mutate", new Error(`File not found: ${path.basename(targetPath)}`), HINTS.fileNotFound);
            }

            const projectRoot = findProjectRoot(targetPath);
            if (!projectRoot) {
                return toolError("flint_ast_mutate", new Error(`Could not find project root (${BRAND.configDir} directory)`), HINTS.fileNotFound);
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
                return toolError("flint_ast_mutate", new Error(`Failed to parse target file: ${err.message}`), HINTS.parseError);
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

            // UCFG.7a: Approval gate check — evaluate configurable gates from flint.config.yaml
            // before committing any write to disk. Dry runs bypass this check entirely.
            if (!dryRunMutate) {
                const yamlConfig = loadProjectConfig(projectRoot);
                if (yamlConfig?.trust?.approval && yamlConfig.trust.approval.length > 0) {
                    const { evaluateApprovalGates } = await import('./core/governance/approvalGateService.js');

                    // Build context: compute a type-weighted risk score rather than a flat
                    // batch-size heuristic. Structural ops (insertNode, deleteNode, etc.) carry
                    // more inherent risk than property ops. Cap at 100.
                    const STRUCTURAL_OP_SCORE = 20; // move, inject, delete, wrap, assembleLayout
                    const PROPERTY_OP_SCORE = 8;    // updateProp, updateClassName, updateTextContent, fixToken
                    const DEFAULT_OP_SCORE = 12;    // emit*, composeSlot, and any unknown types

                    const STRUCTURAL_OPS = new Set(['move', 'inject', 'delete', 'wrap', 'assembleLayout']);
                    const PROPERTY_OPS = new Set(['updateProp', 'updateClassName', 'updateTextContent', 'fixToken']);

                    const weightedRiskScore = Math.min(
                        mutations.reduce((sum, m) => {
                            const opType = (m as Record<string, unknown>).type as string;
                            if (STRUCTURAL_OPS.has(opType)) return sum + STRUCTURAL_OP_SCORE;
                            if (PROPERTY_OPS.has(opType)) return sum + PROPERTY_OP_SCORE;
                            return sum + DEFAULT_OP_SCORE;
                        }, 0),
                        100
                    );

                    const gateContext: Record<string, number> = {
                        risk_score: weightedRiskScore,
                        mutation_count: mutations.length,
                    };

                    const decision = evaluateApprovalGates(yamlConfig.trust.approval, gateContext);

                    if (decision.action === 'require_approval' || decision.action === 'escalate') {
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    status: decision.action === 'escalate' ? 'escalation_required' : 'approval_required',
                                    message: decision.message ?? (decision.action === 'escalate'
                                        ? 'Mutation requires escalation review before writing.'
                                        : 'Mutation requires approval before writing.'),
                                    mutations_applied: mutations.length,
                                    risk_context: gateContext,
                                    gate: decision.matchedGate,
                                    pending_code: newCode,
                                }, null, 2),
                            }],
                        };
                    }
                    // auto_approve and no_gate fall through to the write block below
                }
            }

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
                return toolError("read_design_intent", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                return toolError("read_design_intent", err, HINTS.parseError);
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
            const registryProjectRoot = projectRootArg ?? projectRoot;

            if (!query) {
                return toolError("flint_query_registry", new Error("Missing required parameter: query or semantic_query"), HINTS.missingParam("flint_query_registry query='button component'"));
            }

            if (!fs.existsSync(registryProjectRoot)) {
                return toolError("flint_query_registry", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }

            // Hydrate the RAG cache with the local manifest so freshly-opened
            // projects are searchable without a prior flint_add_remote_library call.
            {
                const localManifestPath = path.join(registryProjectRoot, BRAND.manifestFile);
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
            const registryWarnings: string[] = [];
            try {
                matches = await queryRAGRegistry(query, limit);
            } catch (err) {
                console.error(`${logTag("Registry")} RAG search failed, falling back to manifest relevance`, err);
                registryWarnings.push("Registry vector search unavailable — results are from manifest keyword matching only. Run flint_reindex_registry to restore keyword + n-gram similarity search.");

                const manifestPath = path.join(registryProjectRoot, BRAND.manifestFile);
                let components: Record<string, any> = {};

                if (fs.existsSync(manifestPath)) {
                    try {
                        const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                        components = raw.components ?? {};
                    } catch (err: any) {
                        console.error("Failed to parse manifest for fallback", err);
                        registryWarnings.push("Component registry unavailable — run flint_reindex_registry to rebuild.");
                    }
                }
                matches = queryRegistry(components, query, Math.max(1, Math.min(limit, 10)));
            }

            const artifact = formatShadowStorybook(matches, query);
            const registryWarningNote = registryWarnings.length > 0
                ? `\n\nWarnings:\n${registryWarnings.map(w => `• ${w}`).join("\n")}`
                : "";
            return finishRegistry({ content: [{ type: "text", text: `${artifact}${registryWarningNote}` }] });
        }


        case "flint_audit": {
            return handleAudit(
                request.params.arguments as unknown as Parameters<typeof handleAudit>[0],
                toolCtx,
            );
        }

        case "flint_fix": {
            return handleFix(
                request.params.arguments as unknown as Parameters<typeof handleFix>[0],
                toolCtx,
            );
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
                projectRoot?: string;
            };

            // CHRON.1 (TB-15): Build override lookup when projectRoot is provided and
            // format is 'sarif'. The lookup queries the overrideTelemetryService for the
            // most-recent user-written reason for a given ruleId+filePath combination.
            // W.A: 'skipped' and 'auto' reasons are filtered inside buildSarifOutput.
            let overrideLookupFn: import("./tools/auditReport.js").OverrideLookupFn | undefined;
            if (auditReportArgs.projectRoot && auditReportArgs.format === "sarif") {
                const overrideSvc = getOverrideTelemetryService(auditReportArgs.projectRoot);
                overrideLookupFn = (ruleId: string, filePath: string) => {
                    const events = overrideSvc.getOverridesByRule(ruleId, 50);
                    const match = events.find((e) => e.reason !== null);
                    if (match === undefined || match.reason === null) return null;
                    return { reason: match.reason, timestamp: match.timestamp };
                };
            }

            const result = handleAuditReport({
                source: auditReportArgs.source,
                filePath: auditReportArgs.filePath,
                format: auditReportArgs.format,
                tokens: auditReportArgs.tokens as any,
                sourceAuthority: auditReportArgs.sourceAuthority,
                projectRoot: auditReportArgs.projectRoot,
                overrideLookup: overrideLookupFn,
            });
            return result;
        }

        case "flint_debt_report": {
            const { glob: globPattern, format = "json", track = false } = request.params.arguments as {
                glob?: string;
                format?: "json" | "markdown";
                track?: boolean;
            };

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

            // CLARITY-2: Generate actionable recommendation
            let debtRecommendation: string;
            if (report.grade === 'A') {
                debtRecommendation = 'Grade A — your design system is healthy. Keep it up.';
            } else if (report.grade === 'F') {
                debtRecommendation = `Grade F — ${report.totalViolations} issues need urgent attention. Run 'fix it' to start.`;
            } else {
                const topCategoryEntry = Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])[0];
                const categoryHint = topCategoryEntry ? ` Focus on ${topCategoryEntry[0]} drifts to improve.` : '';
                debtRecommendation = `Grade ${report.grade} — ${report.totalViolations} issue(s) to address.${categoryHint}`;
            }

            return {
                content: [
                    { type: "text", text: debtSummary },
                    { type: "text", text },
                    { type: "text", text: JSON.stringify({ recommendation: debtRecommendation }) },
                ],
            };
        }

        case "flint_set_policy": {
            return handleSetPolicy(
                request.params.arguments as unknown as Parameters<typeof handleSetPolicy>[0],
                toolCtx,
            );
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
            return handleGenerateDBOM(dbomArgs, projectRoot);
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
                return toolError("flint_mutation_provenance", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                        return toolError("flint_mutation_provenance", new Error("action='audit_trail' requires 'filePath'."), HINTS.missingParam("flint_mutation_provenance action='audit_trail' filePath='/path/to/file.tsx'"));
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
                        return toolError("flint_mutation_provenance", new Error("action='by_source' requires 'source'."), HINTS.missingParam("flint_mutation_provenance action='by_source' source='agent'"));
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
                    return toolError("flint_mutation_provenance", new Error(`unknown action '${(provArgs as { action: string }).action}'. Must be 'summary', 'audit_trail', or 'by_source'.`), HINTS.missingParam("flint_mutation_provenance action='summary' projectRoot='...'"));
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
                return toolError("flint_agent_risk", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                        return toolError("flint_agent_risk", new Error("action='by_agent' requires 'agentId'."), HINTS.missingParam("flint_agent_risk action='by_agent' agentId='my-agent'"));
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
                    return toolError("flint_agent_risk", new Error(`unknown action '${(arArgs as { action: string }).action}'. Must be 'summary' or 'by_agent'.`), HINTS.missingParam("flint_agent_risk action='summary' projectRoot='...'"));
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
                return toolError("flint_override_telemetry", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                        return toolError("flint_override_telemetry", new Error("action='by_session' requires 'sessionId'."), HINTS.missingParam("flint_override_telemetry action='by_session' sessionId='<uuid>'"));
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
                        return toolError("flint_override_telemetry", new Error("action='by_rule' requires 'ruleId'."), HINTS.missingParam("flint_override_telemetry action='by_rule' ruleId='A11Y-001'"));
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
                    return toolError("flint_override_telemetry", new Error(`unknown action '${(ovrArgs as { action: string }).action}'. Must be 'summary', 'by_session', or 'by_rule'.`), HINTS.missingParam("flint_override_telemetry action='summary' projectRoot='...'"));
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
                return toolError("flint_anomaly_report", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                    return toolError("flint_anomaly_report", new Error(`unknown action '${(anomArgs as { action: string }).action}'. Must be 'detect', 'history', or 'baseline'.`), HINTS.missingParam("flint_anomaly_report action='detect' projectRoot='...'"));
                }
            }
        }

        case "flint_drift_trend": {
            const driftArgs = request.params.arguments as {
                projectRoot: string;
                windowDays?: number;
                repeatOffenderThreshold?: number;
                spikeAlertPercent?: number;
            };

            if (!driftArgs.projectRoot || !fs.existsSync(driftArgs.projectRoot)) {
                return toolError("flint_drift_trend", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }

            const driftSvc = getDriftTrendService(driftArgs.projectRoot);
            const trend = driftSvc.computeTrend(
                driftArgs.windowDays ?? 30,
                {
                    repeatOffenderThreshold: driftArgs.repeatOffenderThreshold,
                    spikeAlertPercent: driftArgs.spikeAlertPercent,
                },
            );

            // Build a human-readable summary line
            const totalViolations = trend.weeklyViolations.reduce((sum, w) => sum + w.total, 0);
            let driftSummary = `${totalViolations} violations over ${trend.window.days} days | Fix rate: ${trend.fixRate.percentage}%`;
            if (trend.repeatOffenders.length > 0) {
                driftSummary += ` | ${trend.repeatOffenders.length} repeat offender(s)`;
            }
            if (trend.alerts.length > 0) {
                driftSummary += ` | ${trend.alerts.length} alert(s)`;
            }

            return {
                content: [{ type: "text", text: `${driftSummary}\n\n${JSON.stringify(trend, null, 2)}` }],
            };
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
                return toolError("flint_risk_score", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }

            const riskSvc = getRiskScoringService(riskArgs.projectRoot);

            switch (riskArgs.action) {
                case "score_mutation": {
                    if (!riskArgs.mutationId) {
                        return toolError("flint_risk_score", new Error("action='score_mutation' requires 'mutationId'."), HINTS.missingParam("flint_risk_score action='score_mutation' mutationId='<uuid>'"));
                    }
                    const result = riskSvc.scoreMutation(riskArgs.mutationId, {
                        violationCount: riskArgs.violationCount,
                        hasCritical: riskArgs.hasCritical,
                        wasAutoFixedFromCritical: riskArgs.wasAutoFixedFromCritical,
                    });
                    if (result === null) {
                        return toolError("flint_risk_score", new Error(`No record found for mutationId '${riskArgs.mutationId}'.`), {
                            causes: ["The mutationId was not found in the change history", "The record may have been pruned or belongs to a different project"],
                            recovery: ["Check the mutation ID from flint_mutation_provenance action='summary'", "Verify the projectRoot matches the project where the mutation was made"],
                        });
                    }
                    // CLARITY-2: recommendation based on risk tier
                    const mutationRec = result.tier === 'low'
                        ? 'Low risk — safe to apply.'
                        : result.tier === 'medium'
                            ? 'Medium risk — review the changes before applying.'
                            : result.tier === 'high'
                                ? 'High risk — review carefully before applying.'
                                : 'Critical risk — escalate for team review before applying.';
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ...result, recommendation: mutationRec }, null, 2) }],
                    };
                }

                case "file_profile": {
                    if (!riskArgs.filePath) {
                        return toolError("flint_risk_score", new Error("action='file_profile' requires 'filePath'."), HINTS.missingParam("flint_risk_score action='file_profile' filePath='/path/to/file.tsx'"));
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
                    const profileRec = profile.meanScore > 66
                        ? 'High average risk for this file — review recent mutations.'
                        : profile.meanScore > 33
                            ? 'Moderate risk — monitor this file during review.'
                            : 'Low risk file — no special attention needed.';
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ...profile, recommendation: profileRec }, null, 2) }],
                    };
                }

                case "project_summary": {
                    const summary = riskSvc.getProjectRiskSummary();
                    const critCount = summary.distribution?.critical ?? 0;
                    const highCount = summary.distribution?.high ?? 0;
                    const projRec = critCount > 0
                        ? `${critCount} critical-risk mutation(s) need urgent review.`
                        : highCount > 0
                            ? `${highCount} high-risk mutation(s) — review before shipping.`
                            : 'Project risk is low across the board.';
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ...summary, recommendation: projRec }, null, 2) }],
                    };
                }

                default: {
                    return toolError("flint_risk_score", new Error(`unknown action '${(riskArgs as { action: string }).action}'. Must be 'score_mutation', 'file_profile', or 'project_summary'.`), HINTS.missingParam("flint_risk_score action='project_summary' projectRoot='...'"));
                }
            }
        }

        case "flint_migrate_config": {
            const { handleMigrateConfig } = await import('./tools/migrateConfig.js')
            const migrateArgs = request.params.arguments as {
                project_name?: string;
                backup?: boolean;
                dry_run?: boolean;
            };
            return handleMigrateConfig(migrateArgs, flintConfig);
        }

        case "flint_migrate_tw": {
            return handleMigrateTw(
                request.params.arguments as unknown as Parameters<typeof handleMigrateTw>[0],
                toolCtx,
            );
        }
        case "flint_agent_trust": {
            return handleAgentTrust(
                request.params.arguments as unknown as Parameters<typeof handleAgentTrust>[0],
                toolCtx,
            );
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
                return toolError("flint_figma_connect", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }

            const connSvc = getSyncConnectionService(syncArgs.projectRoot);

            switch (syncArgs.action) {
                case "connect": {
                    if (!syncArgs.fileKey || !syncArgs.accessToken) {
                        return toolError("flint_figma_connect", new Error("action='connect' requires 'fileKey' and 'accessToken'."), HINTS.noFigmaConnection);
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
                    return toolError("flint_figma_connect", new Error(`unknown action '${(syncArgs as { action: string }).action}'. Must be 'connect', 'disconnect', or 'status'.`), HINTS.missingParam("flint_figma_connect action='connect' projectRoot='...' fileKey='...' accessToken='...'"));
                }
            }
        }

        // -----------------------------------------------------------------
        // SYNC.2 — Three-Way Diff Sync Tools
        // -----------------------------------------------------------------

        case "flint_sync_pull": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return toolError("flint_sync_pull", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            try {
                const engine = getSyncEngine(args.projectRoot);
                const result = await engine.executePull(args.projectRoot);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (err: unknown) {
                return toolError("flint_sync_pull", err, HINTS.noFigmaConnection);
            }
        }

        case "flint_sync_push": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return toolError("flint_sync_push", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            try {
                const engine = getSyncEngine(args.projectRoot);
                const result = await engine.executePush(args.projectRoot);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (err: unknown) {
                return toolError("flint_sync_push", err, HINTS.noFigmaConnection);
            }
        }

        case "flint_resolve_conflict": {
            const args = request.params.arguments as { conflictId: string; resolution: "local" | "remote" | "merged"; mergedValue?: string };
            if (!args.conflictId || !args.resolution) {
                return toolError("flint_resolve_conflict", new Error("'conflictId' and 'resolution' are required."), HINTS.missingParam("flint_resolve_conflict conflictId='<id>' resolution='local'"));
            }
            if (args.resolution === "merged" && !args.mergedValue) {
                return toolError("flint_resolve_conflict", new Error("'mergedValue' is required when resolution is 'merged'."), HINTS.missingParam("flint_resolve_conflict conflictId='<id>' resolution='merged' mergedValue='...'"));
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
                return toolError("flint_resolve_all", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            if (!args.resolution || !["local", "remote"].includes(args.resolution)) {
                return toolError("flint_resolve_all", new Error("'resolution' must be 'local' or 'remote'."), HINTS.missingParam("flint_resolve_all projectRoot='...' resolution='local'"));
            }
            const engine = getSyncEngine(args.projectRoot);
            const result = engine.resolveAllConflicts(args.projectRoot, args.resolution);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "flint_sync_check": {
            const args = request.params.arguments as { projectRoot: string };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return toolError("flint_sync_check", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            const checkSvc = getSyncCheckService(args.projectRoot);
            const report = checkSvc.runSyncCheck(args.projectRoot);
            const summary = report.inSync
                ? "Sync status: OK — tokens are in sync with baseline."
                : `Sync status: ${report.recommendation}. ${report.pendingConflicts} conflict(s), ${report.tokensDrifted} token(s) drifted.`;
            // CLARITY-2: Generate actionable recommendation
            const syncRecommendation = report.inSync
                ? "All tokens are in sync. No action needed."
                : `${report.tokensDrifted} token(s) drifted from Figma. Run 'sync pull' to update.`;
            return { content: [{ type: "text", text: summary }, { type: "text", text: JSON.stringify({ ...report, recommendation: syncRecommendation }, null, 2) }] };
        }

        case "flint_sync_history": {
            const args = request.params.arguments as { projectRoot: string; format?: "json" | "csv" };
            if (!args.projectRoot || !fs.existsSync(args.projectRoot)) {
                return toolError("flint_sync_history", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
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
                return toolError("flint_validate_themes", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            if (!Array.isArray(args.themeFiles)) {
                return toolError("flint_validate_themes", new Error("'themeFiles' must be an array of token file paths."), HINTS.missingParam("flint_validate_themes projectRoot='...' themeFiles=['tokens/light.json','tokens/dark.json']"));
            }
            // SEC.5-style path traversal check: all themeFiles must resolve within projectRoot
            const resolvedRoot_vt = path.resolve(args.projectRoot);
            for (const tf of args.themeFiles) {
                const resolved = path.resolve(resolvedRoot_vt, tf);
                if (!resolved.startsWith(resolvedRoot_vt + path.sep) && resolved !== resolvedRoot_vt) {
                    return toolError("flint_validate_themes", new Error(`path '${tf}' escapes projectRoot.`), undefined);
                }
            }
            if (args.filePaths) {
                for (const fp of args.filePaths) {
                    const resolved = path.resolve(resolvedRoot_vt, fp);
                    if (!resolved.startsWith(resolvedRoot_vt + path.sep) && resolved !== resolvedRoot_vt) {
                        return toolError("flint_validate_themes", new Error(`path '${fp}' escapes projectRoot.`), undefined);
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
                return toolError("flint_migrate_ds", new Error("'projectRoot' must be an existing directory."), HINTS.fileNotFound);
            }
            // SEC.5-style path traversal check
            const resolvedRoot_md = path.resolve(args.projectRoot);
            const oldPath = path.resolve(resolvedRoot_md, args.oldTokens);
            const newPath = path.resolve(resolvedRoot_md, args.newTokens);
            if (!oldPath.startsWith(resolvedRoot_md + path.sep) && oldPath !== resolvedRoot_md) {
                return toolError("flint_migrate_ds", new Error(`oldTokens path '${args.oldTokens}' escapes projectRoot.`), undefined);
            }
            if (!newPath.startsWith(resolvedRoot_md + path.sep) && newPath !== resolvedRoot_md) {
                return toolError("flint_migrate_ds", new Error(`newTokens path '${args.newTokens}' escapes projectRoot.`), undefined);
            }
            if (args.filePaths) {
                for (const fp of args.filePaths) {
                    const resolved = path.resolve(resolvedRoot_md, fp);
                    if (!resolved.startsWith(resolvedRoot_md + path.sep) && resolved !== resolvedRoot_md) {
                        return toolError("flint_migrate_ds", new Error(`filePath '${fp}' escapes projectRoot.`), undefined);
                    }
                }
            }
            if (!fs.existsSync(oldPath)) {
                console.error(`[flint_migrate_ds] old tokens file not found: ${oldPath}`);
                return toolError("flint_migrate_ds", new Error(`old tokens file not found: ${path.basename(oldPath)}`), HINTS.fileNotFound);
            }
            if (!fs.existsSync(newPath)) {
                console.error(`[flint_migrate_ds] new tokens file not found: ${newPath}`);
                return toolError("flint_migrate_ds", new Error(`new tokens file not found: ${path.basename(newPath)}`), HINTS.fileNotFound);
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
                return toolError("flint_enrich_registry", new Error("'projectRoot' parameter is required."), HINTS.missingParam("flint_enrich_registry projectRoot='/path/to/project'"));
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
                return toolError("flint_approve_enrichment", new Error("'projectRoot' parameter is required."), HINTS.missingParam("flint_approve_enrichment projectRoot='...' componentName='Button' action='approve'"));
            }
            if (!approveArgs.componentName || typeof approveArgs.componentName !== "string") {
                return toolError("flint_approve_enrichment", new Error("'componentName' parameter is required."), HINTS.missingParam("flint_approve_enrichment projectRoot='...' componentName='Button' action='approve'"));
            }
            if (approveArgs.action !== "approve" && approveArgs.action !== "dismiss") {
                return toolError("flint_approve_enrichment", new Error("'action' must be 'approve' or 'dismiss'."), HINTS.missingParam("flint_approve_enrichment projectRoot='...' componentName='Button' action='approve'"));
            }
            const approveResult = handleApproveEnrichment(approveArgs);
            if (!approveResult.ok) {
                return toolError("flint_approve_enrichment", new Error(approveResult.error ?? "unknown error."), undefined);
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
                return toolError("flint_reindex_registry", new Error("'projectRoot' parameter is required."), HINTS.missingParam("flint_reindex_registry projectRoot='/path/to/project'"));
            }
            const reindexResult = await handleReindexRegistry(reindexArgs);
            if (reindexResult.error) {
                return toolError("flint_reindex_registry", new Error(reindexResult.error), HINTS.registryEmpty);
            }
            return {
                content: [{ type: "text", text: JSON.stringify(reindexResult, null, 2) }],
            };
        }

        // -----------------------------------------------------------------
        // V.4 — Epistemic Consensus Gate Query
        // -----------------------------------------------------------------

        case "flint_consensus_report": {
            const consensusArgs = request.params.arguments as {
                mode: "summary" | "by_session" | "by_agent" | "disagreements";
                sessionId?: string;
                agentId?: string;
                limit?: number;
            };

            const consensusSvc = getConsensusQueryService(projectRoot);

            switch (consensusArgs.mode) {
                case "summary": {
                    const result = consensusSvc.getSummary();
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "by_session": {
                    if (!consensusArgs.sessionId) {
                        return toolError("flint_consensus_report", new Error("mode='by_session' requires 'sessionId'."), HINTS.missingParam("flint_consensus_report mode='by_session' sessionId='<uuid>'"));
                    }
                    const result = consensusSvc.getBySession(consensusArgs.sessionId, consensusArgs.limit);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "by_agent": {
                    if (!consensusArgs.agentId) {
                        return toolError("flint_consensus_report", new Error("mode='by_agent' requires 'agentId'."), HINTS.missingParam("flint_consensus_report mode='by_agent' agentId='my-agent'"));
                    }
                    const result = consensusSvc.getByAgent(consensusArgs.agentId, consensusArgs.limit);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "disagreements": {
                    const result = consensusSvc.getDisagreements(consensusArgs.limit);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                default: {
                    return toolError("flint_consensus_report", new Error(`unknown mode '${(consensusArgs as { mode: string }).mode}'. Must be 'summary', 'by_session', 'by_agent', or 'disagreements'.`), HINTS.missingParam("flint_consensus_report mode='summary'"));
                }
            }
        }

        // -----------------------------------------------------------------
        // EXP.7 -- Cross-Platform Token Sync
        // -----------------------------------------------------------------

        case "flint_emit_tokens": {
            const emitArgs = request.params.arguments as {
                platforms?: string[];
                outputDir?: string;
                dryRun?: boolean;
                projectRoot?: string;
                mode?: string;
                collection?: string;
                prefix?: string;
            };
            return handleEmitTokens(emitArgs as Parameters<typeof handleEmitTokens>[0], projectRoot);
        }

        // -----------------------------------------------------------------
        // Library Token Mapping
        // -----------------------------------------------------------------

        case "flint_map_tokens": {
            const mapArgs = request.params.arguments as {
                library: string;
                projectRoot?: string;
                basePreset?: string;
                mode?: string;
                collection?: string;
                writeFile?: boolean;
                outputPath?: string;
            };
            return handleMapTokens(mapArgs);
        }

        // -----------------------------------------------------------------
        // LIB.1 -- Set Active Library
        // -----------------------------------------------------------------

        case "flint_set_library": {
            const libArgs = request.params.arguments as {
                library: string;
                projectRoot?: string;
            };
            return handleSetLibrary(libArgs);
        }

        // -----------------------------------------------------------------
        // LIB.2 -- Design to Code (end-to-end Figma → library pipeline)
        // -----------------------------------------------------------------

        case "flint_design_to_code": {
            const d2cArgs = request.params.arguments as {
                figmaPayload: string;
                library?: string;
                projectRoot?: string;
                writeThemeFile?: boolean;
                figmaUrl?: string;
                figmaCode?: string;
                aiClassify?: boolean;
                aiRefine?: boolean;
                screenshotBase64?: string;
                designSystemDocs?: string;
                codeConnectSuggestions?: string;
            };
            const result = await handleDesignToCode(d2cArgs, flintConfig);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        // -----------------------------------------------------------------
        // GPX.1 -- Governance Pack Export
        // -----------------------------------------------------------------

        case "flint_pack_export": {
            const exportArgs = request.params.arguments as {
                id: string;
                name: string;
                version: string;
                description: string;
                author: { name: string; email?: string; org?: string };
                stack_tags?: string[];
                include_claude_fragments?: string[];
                output_path?: string;
                dry_run?: boolean;
                projectRoot?: string;
            };
            return handlePackExport(exportArgs, projectRoot);
        }

        // -----------------------------------------------------------------
        // GPX.2 -- Governance Pack Import + Rollback
        // -----------------------------------------------------------------

        case "flint_pack_import": {
            const importArgs = request.params.arguments as {
                source: string;
                projectRoot: string;
                strategy?: 'override' | 'skip-conflicts' | 'interactive';
                resolutions?: Array<{ key: string; action: 'accept_incoming' | 'keep_current' | 'custom'; customValue?: unknown }>;
                dry_run?: boolean;
            };
            return handlePackImport(importArgs);
        }

        case "flint_pack_rollback": {
            const rollbackArgs = request.params.arguments as {
                snapshotId: string;
                projectRoot: string;
            };
            return handlePackRollback(rollbackArgs);
        }

        case "flint_defer_violation": {
            const deferArgs = request.params.arguments as {
                file: string;
                ruleId: string;
                nodeId?: string;
                reason?: string;
                projectRoot: string;
            };
            return handleDeferViolation(deferArgs);
        }

        // -----------------------------------------------------------------
        // D2C.4 Feature 2 -- Token Extraction from Figma (approval gateway)
        // -----------------------------------------------------------------

        case "flint_extract_tokens": {
            const extractArgs = request.params.arguments as {
                figmaPayload: string;
                projectRoot?: string;
                minUsageCount?: number;
                minConfidence?: number;
            };
            return handleExtractTokens(extractArgs);
        }

        case "flint_approve_tokens": {
            const approveArgs = request.params.arguments as {
                tokens: Array<{ path: string; value: string; type: string }>;
                source?: string;
                projectRoot?: string;
                sessionId?: string;
            };
            return handleApproveTokens(approveArgs);
        }

        // -----------------------------------------------------------------
        // D2C.4 Feature 3 -- Code Connect Auto-Registration
        // -----------------------------------------------------------------

        case "flint_code_connect_sync": {
            const ccArgs = request.params.arguments as {
                library?: string;
                action?: "generate" | "write";
                projectRoot?: string;
            };
            return handleCodeConnectSync(ccArgs);
        }

        // -----------------------------------------------------------------
        // Figma Variables → DesignToken conversion
        // -----------------------------------------------------------------

        case "flint_pull_variables": {
            const pullArgs = request.params.arguments as {
                variablesPayload: string;
                fileKey?: string;
                mode?: string;
            };
            return handlePullVariables(pullArgs);
        }

        case "flint_quickstart": {
            const qsArgs = request.params.arguments as { outputDir?: string } ?? {};
            return handleFlintQuickstart(qsArgs, flintConfig);
        }

        // -----------------------------------------------------------------
        // ERM.1 — Rule Pack Management
        // -----------------------------------------------------------------

        case "flint_list_rule_packs": {
            const listPackArgs = (request.params.arguments ?? {}) as {
                domain?: string;
                jurisdiction?: string;
                status?: string;
            };
            return handleListRulePacks(listPackArgs);
        }

        case "flint_enable_pack": {
            const enablePackArgs = request.params.arguments as {
                pack_id: string;
                projectRoot?: string;
            };
            return handleEnablePack(enablePackArgs);
        }

        case "flint_disable_pack": {
            const disablePackArgs = request.params.arguments as {
                pack_id: string;
                projectRoot?: string;
            };
            return handleDisablePack(disablePackArgs);
        }

        case "flint_set_rule_mode": {
            const setRuleModeArgs = request.params.arguments as {
                rule_id: string;
                mode: "coercive" | "normative" | "advisory" | "off";
                projectRoot?: string;
            };
            return handleSetRuleMode(setRuleModeArgs);
        }

        case "flint_compliance_coverage": {
            const coverageArgs = (request.params.arguments ?? {}) as {
                jurisdictions?: string[];
                projectRoot?: string;
            };
            return handleComplianceCoverage(coverageArgs);
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

/**
 * MAJOR-4: Build a human-readable markdown summary for flint_audit responses.
 * Prepended to the JSON so IDE agents can relay findings without parsing.
 */
export function buildAuditSummary(result: { violations: Array<{ ruleId: string; severity: string; message: string }>; mithrilCount: number; a11yCount: number; summary?: string; recommendation?: string; exportBlocked?: boolean }, filePath: string): string {
    const basename = path.basename(filePath);
    const verdict = result.exportBlocked ? "BLOCKED" : "APPROVED";
    const total = result.violations.length;
    const lines = [`## Flint Audit — ${basename}`, ""];
    lines.push(`**Verdict:** ${verdict} | **Mithril:** ${result.mithrilCount} | **Warden (a11y):** ${result.a11yCount} | **Total:** ${total}`);
    if (result.summary) lines.push("", result.summary);
    if (total > 0) {
        lines.push("", "### Top violations", "");
        const top5 = result.violations.slice(0, 5);
        for (const v of top5) {
            lines.push(`- **${v.ruleId}** (${v.severity}): ${v.message}`);
        }
        if (total > 5) lines.push(`- _...and ${total - 5} more_`);
    }
    if (result.recommendation) lines.push("", `**Next step:** ${result.recommendation}`);
    return lines.join("\n");
}

/**
 * Sprint 4 D7 — Parse and sandbox a `flint://violations/<path>` URI.
 *
 *   - Strips the `flint://violations/` prefix and decodeURIComponents it
 *   - On Windows, handles a leading `/C:/` pattern (URIs get a stray leading
 *     slash in front of the drive letter) so the resolved path is `C:\…`
 *   - Normalizes separators via `path.normalize`
 *   - Sandboxes the result inside `projectRoot` — returns `null` for any
 *     traversal or out-of-root path
 *
 * @param uri           Full `flint://violations/...` URI
 * @param projectRoot   Absolute project root to sandbox within
 * @returns Absolute path inside projectRoot, or `null` if invalid
 */
export function parseViolationsUri(
    uri: string,
    projectRoot: string,
): string | null {
    const prefix = resourceUri('violations/');
    if (!uri.startsWith(prefix)) return null;
    const raw = decodeURIComponent(uri.slice(prefix.length));
    if (!raw) return null;

    // Windows drive-letter patch: `flint://violations/C:/foo` decodes to
    // `C:/foo`; the older `"/" +` prefix broke this by producing `/C:/foo`.
    // Detect both shapes so we behave consistently across platforms.
    let candidate = raw;
    if (process.platform === 'win32') {
        if (/^\/[A-Za-z]:/.test(candidate)) {
            candidate = candidate.slice(1);
        }
    }
    candidate = path.normalize(candidate);

    const absolute = path.isAbsolute(candidate)
        ? candidate
        : path.resolve(projectRoot, candidate);

    // Sandbox check: must live inside projectRoot.
    const rel = path.relative(projectRoot, absolute);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return absolute;
}

export function findProjectRoot(startPath: string): string | null {
    let curr = path.dirname(startPath);
    while (curr !== path.parse(curr).root) {
        // Require both .flint/ AND flint-manifest.json (or design-tokens.json) to distinguish
        // a real project root from nested .flint/ telemetry artifacts (e.g. src/components/ui/.flint).
        if (fs.existsSync(path.join(curr, BRAND.configDir))) {
            if (
                fs.existsSync(path.join(curr, BRAND.manifestFile)) ||
                fs.existsSync(path.join(curr, BRAND.configDir, 'design-tokens.json'))
            ) {
                return curr;
            }
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

    // Strategy 1: The Greeter — set context-aware instructions now that
    // the project root is known. The MCP SDK stores instructions as a
    // simple property on the server instance.
    (server as any)._instructions = buildGreeting(projectRoot);

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
