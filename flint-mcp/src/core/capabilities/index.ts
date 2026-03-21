/**
 * flint://capabilities — structured catalog of all Flint MCP tools, resources, and prompts.
 *
 * This resource is the primary discoverability surface for new users and AI agents
 * connecting to the Flint MCP server. It answers "what can Flint do?" in a single
 * machine-readable document, including parameter shapes, usage examples, categories,
 * and common multi-tool workflow sequences.
 */

export const CAPABILITIES_RESOURCE = {
    uri: "flint://capabilities",
    name: "Flint Tool Catalog",
    description:
        "Complete catalog of all Flint MCP tools with parameters, examples, and workflow sequences.",
    mimeType: "application/json",
} as const;

// ---------------------------------------------------------------------------
// Catalog types
// ---------------------------------------------------------------------------

interface ToolEntry {
    name: string;
    description: string;
    category: ToolCategory;
    parameters: ParameterSummary[];
    example: ExampleInvocation;
}

interface ParameterSummary {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

interface ExampleInvocation {
    description: string;
    args: Record<string, unknown>;
}

interface ResourceEntry {
    uri: string;
    description: string;
    mimeType: string;
}

interface PromptEntry {
    name: string;
    description: string;
    arguments?: Array<{ name: string; required: boolean; description: string }>;
}

interface WorkflowEntry {
    name: string;
    description: string;
    steps: string[];
}

interface CapabilitiesCatalog {
    schema_version: string;
    generated_at: string;
    tools: ToolEntry[];
    resources: ResourceEntry[];
    prompts: PromptEntry[];
    workflows: WorkflowEntry[];
}

type ToolCategory =
    | "Context"
    | "Audit"
    | "Fix"
    | "Tokens"
    | "Report"
    | "Governance"
    | "Migration"
    | "Platform"
    | "Collaboration";

// ---------------------------------------------------------------------------
// Tool catalog
// ---------------------------------------------------------------------------

const TOOLS: ToolEntry[] = [
    // Context -------------------------------------------------------------------
    {
        name: "flint_get_context",
        category: "Context",
        description:
            "Returns the current Flint project context — active file source (first 200 lines), " +
            "canvas state, violation summary, token snapshot, last 5 mutations, and health score. " +
            "Call this first to ground any agent session in a single round-trip. " +
            "Backed by flint://session-context resource.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root (must contain a .flint directory).",
            },
        ],
        example: {
            description: "Read current session context before starting any governance workflow.",
            args: { projectRoot: "/home/user/my-app" },
        },
    },
    {
        name: "flint_assess_complexity",
        category: "Context",
        description:
            "Analyze the complexity of a proposed task and recommend the appropriate AI model tier (fast/balanced/powerful). " +
            "Returns a 0-100 complexity score with factor breakdown. Use before multi-step workflows to ensure the right model is selected.",
        parameters: [
            {
                name: "taskDescription",
                type: "string",
                required: true,
                description: "Natural language description of the task to assess.",
            },
            {
                name: "estimatedNodeCount",
                type: "number",
                required: false,
                description: "Estimated number of AST nodes that will be affected.",
            },
            {
                name: "crossFile",
                type: "boolean",
                required: false,
                description: "Whether the task spans multiple source files.",
            },
            {
                name: "mutationTypes",
                type: "string[]",
                required: false,
                description: "Mutation types that will be used (e.g. updateProp, deleteNode).",
            },
            {
                name: "projectRoot",
                type: "string",
                required: false,
                description: "Project root for context lookup.",
            },
        ],
        example: {
            description: "Assess a cross-file refactor before starting.",
            args: {
                taskDescription: "Extract the hero section into a shared layout component",
                crossFile: true,
                estimatedNodeCount: 12,
                projectRoot: "/home/user/my-app",
            },
        },
    },
    {
        name: "flint_status",
        category: "Context",
        description:
            "Returns the operational status of the Flint MCP server — which engines are active, server version, and configured project root.",
        parameters: [],
        example: {
            description: "Health-check the Flint MCP server.",
            args: {},
        },
    },

    // Audit ---------------------------------------------------------------------
    {
        name: "flint_audit",
        category: "Audit",
        description:
            "Run full Flint governance audit on source code — Mithril (CIEDE2000 ΔE color drift), A11y (WCAG 2.1 AA), and all loaded domain rule sets. Returns violations grouped by rule ID.",
        parameters: [
            {
                name: "source",
                type: "string",
                required: true,
                description: "The full source code of the file to audit.",
            },
            {
                name: "filePath",
                type: "string",
                required: true,
                description: "Absolute path of the source file (used for import resolution).",
            },
            {
                name: "ruleIds",
                type: "string[]",
                required: false,
                description: "Restrict audit to specific rule IDs (e.g. ['A11Y-001', 'CLR-003']).",
            },
            {
                name: "severity",
                type: "'info' | 'warning' | 'critical'",
                required: false,
                description: "Minimum severity to include in results.",
            },
        ],
        example: {
            description: "Audit a component for color drift and accessibility violations.",
            args: {
                source: "import React from 'react';\nexport const Btn = () => <button style={{color:'#fff'}}>Click</button>;",
                filePath: "/home/user/my-app/src/components/Btn.tsx",
            },
        },
    },
    {
        name: "audit_ui_component",
        category: "Audit",
        description:
            "Run Mithril and A11y audits on a UI component by file path. Convenience wrapper around flint_audit — reads the file automatically.",
        parameters: [
            {
                name: "file",
                type: "string",
                required: true,
                description: "Absolute path to the .tsx or .jsx file to audit.",
            },
        ],
        example: {
            description: "Audit an existing component file.",
            args: { file: "/home/user/my-app/src/components/Button.tsx" },
        },
    },

    // Fix -----------------------------------------------------------------------
    {
        name: "flint_fix",
        category: "Fix",
        description:
            "Auto-apply high-confidence governance fixes to source code. Resolves token drift, missing alt text, and other programmatically correctable violations. Returns a diff and updated source.",
        parameters: [
            {
                name: "source",
                type: "string",
                required: true,
                description: "The full source code to fix.",
            },
            {
                name: "filePath",
                type: "string",
                required: true,
                description: "Absolute path of the file (used for import resolution).",
            },
            {
                name: "violationIds",
                type: "string[]",
                required: false,
                description: "Restrict fixes to specific violation IDs.",
            },
            {
                name: "dryRun",
                type: "boolean",
                required: false,
                description: "If true, returns the proposed fix without writing to disk.",
            },
        ],
        example: {
            description: "Auto-fix all high-confidence violations in a component.",
            args: {
                source: "export const Btn = () => <img src='logo.png' />;",
                filePath: "/home/user/my-app/src/components/Logo.tsx",
                dryRun: true,
            },
        },
    },
    {
        name: "flint_ast_mutate",
        category: "Fix",
        description:
            "Apply a batch of structural AST mutations (move, inject, fixToken, updateProp, updateClassName, updateTextContent, delete, wrap) to a file. This is the only approved method for programmatic code modification — never use raw string replacement.",
        parameters: [
            {
                name: "targetPath",
                type: "string",
                required: true,
                description: "Absolute path to the file to modify.",
            },
            {
                name: "mutations",
                type: "Array<{ type: string; args: object }>",
                required: true,
                description:
                    "Ordered list of mutations. type must be one of: move | inject | fixToken | assembleLayout | updateProp | updateClassName | updateTextContent | delete | wrap.",
            },
            {
                name: "writeFile",
                type: "boolean",
                required: false,
                description: "Write result back to disk (default false — dry run).",
            },
        ],
        example: {
            description: "Replace a hardcoded color class with a design token class.",
            args: {
                targetPath: "/home/user/my-app/src/components/Card.tsx",
                mutations: [
                    {
                        type: "fixToken",
                        args: {
                            nodeId: "flint-card-root",
                            hardcodedClass: "bg-[#1a1a2e]",
                            tokenClass: "bg-brand-navy",
                        },
                    },
                ],
                writeFile: true,
            },
        },
    },

    // Tokens --------------------------------------------------------------------
    {
        name: "flint_sync_tokens",
        category: "Tokens",
        description:
            "Compare or sync design tokens. Accepts an incoming token payload (e.g. from Figma) and either returns a diff or writes the merged result to .flint/design-tokens.json.",
        parameters: [
            {
                name: "direction",
                type: "'figma-to-local' | 'diff-only'",
                required: true,
                description: "figma-to-local writes to disk; diff-only returns only the delta.",
            },
            {
                name: "localTokensPath",
                type: "string",
                required: false,
                description: "Override the default .flint/design-tokens.json path.",
            },
            {
                name: "incomingTokens",
                type: "string",
                required: false,
                description: "JSON string of incoming design tokens (DTCG format).",
            },
        ],
        example: {
            description: "Preview how incoming Figma tokens would change the local token set.",
            args: {
                direction: "diff-only",
                incomingTokens: JSON.stringify([{ name: "brand-primary", value: "#0062ff", type: "color" }]),
            },
        },
    },
    {
        name: "flint_query_registry",
        category: "Tokens",
        description:
            "Search the Flint UI component registry using semantic + keyword relevance. Returns a Shadow Storybook artifact with TypeScript props interface, import path, variants, and required Mithril tokens.",
        parameters: [
            {
                name: "query",
                type: "string",
                required: true,
                description: "Natural language description of the UI element needed.",
            },
            {
                name: "projectRoot",
                type: "string",
                required: false,
                description: "Absolute path to the project root. Defaults to cwd if omitted.",
            },
            {
                name: "limit",
                type: "number",
                required: false,
                description: "Maximum number of matches to return (default 3).",
            },
        ],
        example: {
            description: "Find existing button components before drafting new UI.",
            args: {
                query: "primary action button with loading state",
                projectRoot: "/home/user/my-app",
            },
        },
    },

    // Report --------------------------------------------------------------------
    {
        name: "flint_debt_report",
        category: "Report",
        description:
            "Generate a design debt report across the entire project — aggregated Mithril violations, A11y issues, and token drift hotspots. Useful for sprint planning and prioritization.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
            {
                name: "format",
                type: "'json' | 'markdown'",
                required: false,
                description: "Output format (default 'markdown').",
            },
        ],
        example: {
            description: "Generate a Markdown debt report for the full codebase.",
            args: { projectRoot: "/home/user/my-app", format: "markdown" },
        },
    },
    {
        name: "flint_vpat_report",
        category: "Report",
        description:
            "Generate a VPAT (Voluntary Product Accessibility Template) Section 508 / WCAG 2.1 conformance report for all audited components.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
        ],
        example: {
            description: "Generate a VPAT report for regulatory submission.",
            args: { projectRoot: "/home/user/my-app" },
        },
    },

    // Governance ----------------------------------------------------------------
    {
        name: "flint_consensus_status",
        category: "Governance",
        description:
            "Returns the current state of governance consensus across all agents and team members working in the project. Surfaces conflicting annotation decisions and open debates.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
        ],
        example: {
            description: "Check for open governance debates before merging.",
            args: { projectRoot: "/home/user/my-app" },
        },
    },
    {
        name: "flint_anomaly_report",
        category: "Governance",
        description:
            "Detect anomalous patterns in governance telemetry — unusual violation spikes, repeated auto-fix cycles, or agent behavior that bypasses audit gates.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
            {
                name: "windowHours",
                type: "number",
                required: false,
                description: "Lookback window in hours (default 24).",
            },
        ],
        example: {
            description: "Check for anomalous AI behavior over the past 48 hours.",
            args: { projectRoot: "/home/user/my-app", windowHours: 48 },
        },
    },
    {
        name: "flint_theme_validate",
        category: "Governance",
        description:
            "Validate that the active design theme is internally consistent — no clashing CIEDE2000 ΔE values between token pairs, no typography scale gaps, no shadow opacity violations.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
            {
                name: "strict",
                type: "boolean",
                required: false,
                description: "If true, treat amber violations as failures (default false).",
            },
        ],
        example: {
            description: "Validate the design theme before a release.",
            args: { projectRoot: "/home/user/my-app", strict: true },
        },
    },

    // Migration -----------------------------------------------------------------
    {
        name: "flint_migrate_ds",
        category: "Migration",
        description:
            "Migrate a codebase from one design system to another (e.g. Material UI to Flint Tokens). Performs AST-level class replacement guided by a migration map.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
            {
                name: "migrationMap",
                type: "string",
                required: true,
                description: "JSON string mapping old token names to new ones.",
            },
            {
                name: "dryRun",
                type: "boolean",
                required: false,
                description: "Preview changes without writing to disk.",
            },
        ],
        example: {
            description: "Preview a migration from hardcoded colors to design tokens.",
            args: {
                projectRoot: "/home/user/my-app",
                migrationMap: JSON.stringify({ "text-gray-900": "text-neutral-900" }),
                dryRun: true,
            },
        },
    },
    {
        name: "flint_migrate_tw",
        category: "Migration",
        description:
            "Migrate Tailwind CSS class usage from one major version to another (e.g. Tailwind v3 to v4 syntax changes). Uses AST traversal — no regex.",
        parameters: [
            {
                name: "projectRoot",
                type: "string",
                required: true,
                description: "Absolute path to the project root.",
            },
            {
                name: "fromVersion",
                type: "string",
                required: true,
                description: "Source Tailwind version (e.g. '3').",
            },
            {
                name: "toVersion",
                type: "string",
                required: true,
                description: "Target Tailwind version (e.g. '4').",
            },
            {
                name: "dryRun",
                type: "boolean",
                required: false,
                description: "Preview changes without writing to disk.",
            },
        ],
        example: {
            description: "Preview Tailwind v3 to v4 class migration.",
            args: {
                projectRoot: "/home/user/my-app",
                fromVersion: "3",
                toVersion: "4",
                dryRun: true,
            },
        },
    },

    // Platform ------------------------------------------------------------------
    {
        name: "flint_platform_export",
        category: "Platform",
        description:
            "Export governed components for a target platform (React, Vue, iOS SwiftUI, Android Compose). Validates all Mithril and A11y gates before generating platform output.",
        parameters: [
            {
                name: "componentPath",
                type: "string",
                required: true,
                description: "Absolute path to the .tsx or .jsx source component.",
            },
            {
                name: "target",
                type: "'react' | 'vue' | 'ios' | 'android'",
                required: true,
                description: "Target platform format.",
            },
        ],
        example: {
            description: "Export a Button component to Vue 3 syntax.",
            args: {
                componentPath: "/home/user/my-app/src/components/Button.tsx",
                target: "vue",
            },
        },
    },

    // Collaboration -------------------------------------------------------------
    {
        name: "flint_annotate",
        category: "Collaboration",
        description:
            "Create a governance annotation on a specific AST node — flag a decision, open a debate, or record a compliance note. Stored in flint://annotations and visible to all team members.",
        parameters: [
            {
                name: "nodeId",
                type: "string",
                required: true,
                description: "The data-flint-id of the target AST node.",
            },
            {
                name: "filePath",
                type: "string",
                required: true,
                description: "Absolute path to the file containing the node.",
            },
            {
                name: "type",
                type: "'decision' | 'debate' | 'compliance' | 'question'",
                required: true,
                description: "Category of the annotation.",
            },
            {
                name: "body",
                type: "string",
                required: true,
                description: "The annotation text content.",
            },
        ],
        example: {
            description: "Record a compliance decision on a form input node.",
            args: {
                nodeId: "flint-login-email",
                filePath: "/home/user/my-app/src/components/LoginForm.tsx",
                type: "compliance",
                body: "WCAG 2.1 SC 1.3.1 — label association verified by QA on 2026-03-14.",
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Resource catalog
// ---------------------------------------------------------------------------

const RESOURCES: ResourceEntry[] = [
    {
        uri: "flint://capabilities",
        description:
            "This document — complete catalog of Flint MCP tools, resources, prompts, and workflow sequences.",
        mimeType: "application/json",
    },
    {
        uri: "flint://tokens",
        description:
            "Current normalized design tokens from .flint/design-tokens.json (DTCG format). Read before generating any styled code.",
        mimeType: "application/json",
    },
    {
        uri: "flint://manifest",
        description:
            "Global architecture manifest (flint-manifest.json) — component registry, logic extractors, and resolvers.",
        mimeType: "application/json",
    },
    {
        uri: "flint://rules",
        description:
            "All loaded governance rules grouped by domain (ui, fintech, iac, legal). Authoritative source for what flint_audit checks.",
        mimeType: "application/json",
    },
    {
        uri: "flint://violations/{filePath}",
        description:
            "Live governance audit for a specific file path. Replace {filePath} with the absolute file path (leading slash stripped from URI).",
        mimeType: "application/json",
    },
    {
        uri: "flint://annotations",
        description:
            "All governance annotations created via flint_annotate — decisions, debates, and compliance notes across all project files.",
        mimeType: "application/json",
    },
    {
        uri: "flint://dashboard",
        description:
            "Design debt dashboard — current health score (0-100), letter grade (A-F), violation counts by severity, and last 10 trend snapshots from .flint/debt-history.json.",
        mimeType: "application/json",
    },
    {
        uri: "flint://session-context",
        description:
            "Rich session bootstrap context — active file source (first 200 lines), canvas state, " +
            "violation summary (mithril + a11y counts, node IDs, fixability), token snapshot " +
            "(count by type, top 20), last 5 mutations, and current health score/grade. " +
            "Eliminates 3-4 sequential bootstrap calls per agent session. " +
            "Cached with 500ms TTL. Assembled from .flint/context.json, design-tokens.json, " +
            "mcp-events.jsonl, and debt-history.json.",
        mimeType: "application/json",
    },
];

// ---------------------------------------------------------------------------
// Prompt catalog
// ---------------------------------------------------------------------------

const PROMPTS: PromptEntry[] = [
    {
        name: "flint-intent-composer",
        description:
            "The primary Flint UX/UI Architecture Sentinel persona. Activate when drafting or modifying UI components based on Figma design intent. Mandates audit-before-commit, token resolution, and registry lookup before any code generation.",
    },
    {
        name: "flint-sentinel",
        description:
            "Governance-aware AI assistant persona scoped to a specific enforcement domain. Mandates audit-before-commit behaviour across all code generation within the chosen domain.",
        arguments: [
            {
                name: "domain",
                required: false,
                description:
                    "Governance domain: 'ui' (default) | 'fintech' | 'iac' | 'legal'.",
            },
        ],
    },
    {
        name: "flint-workflow-guide",
        description:
            "Interactive guide for composing multi-tool Flint MCP workflows. Helps users understand which tools to chain together for common tasks such as Figma import, design debt audits, and codebase migrations.",
    },
];

// ---------------------------------------------------------------------------
// Workflow sequences
// ---------------------------------------------------------------------------

const WORKFLOWS: WorkflowEntry[] = [
    {
        name: "audit-then-fix",
        description:
            "Standard governance loop: read context, audit the component, apply auto-fixes for high-confidence violations, then re-audit to confirm resolution.",
        steps: [
            "flint_get_context — ground the session with active file and token snapshot",
            "flint_audit — identify all Mithril and A11y violations",
            "flint_fix — auto-resolve high-confidence violations (dry run first to preview)",
            "flint_audit — re-run to confirm all critical violations are resolved",
        ],
    },
    {
        name: "figma-import",
        description:
            "Full Figma-to-governed-code pipeline: ingest Figma payload, sync tokens, query registry for existing components, then apply AST mutations.",
        steps: [
            "flint_ingest_figma — convert Figma AST payload to governed React snippet",
            "flint_sync_tokens — sync incoming Figma variables to .flint/design-tokens.json",
            "flint_query_registry — check for existing design system components to reuse",
            "flint_ast_mutate — inject the governed snippet into the target file",
            "flint_audit — verify the result passes all governance gates",
        ],
    },
    {
        name: "new-component",
        description:
            "Safe workflow for building a net-new governed component from scratch.",
        steps: [
            "flint_get_context — read active tokens and open violations",
            "flint_query_registry — search for existing components to extend rather than duplicate",
            "flint_audit — audit the draft before committing",
            "flint_fix — resolve auto-fixable issues",
            "flint_ast_mutate — apply final structural mutations (writeFile: true to commit)",
        ],
    },
    {
        name: "design-debt-sprint",
        description:
            "Kick off a design debt reduction sprint: generate a full report, prioritize violations, then batch-fix the highest-impact ones.",
        steps: [
            "flint_debt_report — generate a project-wide design debt summary",
            "flint_audit — deep-audit the highest-severity files identified in the report",
            "flint_fix — apply high-confidence auto-fixes across the debt hotspots",
            "flint_theme_validate — confirm the token theme is consistent after fixes",
        ],
    },
    {
        name: "pre-release-gate",
        description:
            "Final governance check before shipping a release: full audit, VPAT report, and platform export gate.",
        steps: [
            "flint_audit — full project audit with severity: 'critical'",
            "flint_theme_validate (strict: true) — confirm design system consistency",
            "flint_vpat_report — generate WCAG 2.1 conformance report",
            "flint_platform_export — verify all export targets pass governance gates",
        ],
    },
    {
        name: "token-migration",
        description:
            "Migrate a codebase from hardcoded values or a legacy design system to governed Flint tokens.",
        steps: [
            "flint_sync_tokens (direction: 'diff-only') — preview incoming token changes",
            "flint_sync_tokens (direction: 'figma-to-local') — write merged tokens to disk",
            "flint_migrate_ds — apply AST-level class replacement across the codebase",
            "flint_audit — verify all token drift violations are resolved post-migration",
        ],
    },
    {
        name: "collaborative-review",
        description:
            "Structured team review flow: audit, annotate decisions, check consensus, then approve.",
        steps: [
            "flint_audit — surface all violations for team review",
            "flint_annotate — record decisions, debates, or compliance notes on specific nodes",
            "flint_consensus_status — check for conflicting annotation decisions across agents",
            "flint_fix — apply agreed-upon fixes once consensus is reached",
        ],
    },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build and return the full capabilities catalog as a JSON string.
 * Called by the ReadResource handler in server.ts when uri === 'flint://capabilities'.
 */
export function readCapabilities(): string {
    const catalog: CapabilitiesCatalog = {
        schema_version: "1.0.0",
        generated_at: new Date().toISOString(),
        tools: TOOLS,
        resources: RESOURCES,
        prompts: PROMPTS,
        workflows: WORKFLOWS,
    };
    return JSON.stringify(catalog, null, 2);
}
