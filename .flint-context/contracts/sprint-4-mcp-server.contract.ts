/**
 * Sprint 4 — MCP Server + Registrations
 *
 * Executable contract. Phase 2 agents import types from this file.
 * Companion document: ./sprint-4-mcp-server.md
 */

import type {
  FlintContract,
  ImpactEntry,
  TestBoundary,
  RiskEntry,
} from '../../shared/contract-schema.js';

// ─── Type Contracts (Phase 2 implements against these) ──────────────

/**
 * Central Zod schema registry signature.
 * Implementation: flint-mcp/src/tools/schemas.ts
 */
export interface ToolInputSchemaRegistry {
  /** Map of MCP tool name → Zod schema. Populated for all 59 registered tools. */
  TOOL_INPUT_SCHEMAS: Record<string, unknown /* z.ZodTypeAny — kept untyped to avoid pulling zod into the contract */>;
}

export type ValidateToolInputResult =
  | { ok: true; args: unknown }
  | { ok: false; error: string };

export type ValidateToolInput = (
  toolName: string,
  args: unknown
) => ValidateToolInputResult;

/**
 * Common context object passed to every extracted tool handler.
 * Implementation: flint-mcp/src/tools/handlers/types.ts
 */
export interface ResolvedToolContext {
  projectRoot: string;
  /** Slimmed FlintConfig — after D3 the legacy `policy` field is removed. */
  flintConfig: {
    projectRoot: string;
    domains: string[];
  };
  /**
   * Canonical resolved policy for this request. Hoisted once per
   * CallToolRequest callback via `loadAndResolvePolicy(projectRoot)` so policy
   * edits via flint_set_policy are reflected on the next call without a reload.
   * Phase 2 imports the real `ResolvedPolicy` type from policyEngine.
   */
  resolved: unknown;
}

/**
 * Extracted handler signature.
 * Implementation: flint-mcp/src/tools/handlers/<tool>.handler.ts
 */
export type ToolHandler<TArgs = unknown, TResult = unknown> = (
  args: TArgs,
  ctx: ResolvedToolContext
) => Promise<TResult>;

/**
 * Rule pack reverse-lookup helper added to rulePackRegistry.
 * Implementation: flint-mcp/src/core/rulePackRegistry.ts
 */
export interface RulePackRegistryExtensions {
  findPackForRule(ruleId: string): { id: string; name: string } | null;
}

/**
 * Enriched rule shape returned by flint://rules after Sprint 4.
 */
export interface EnrichedRule {
  id: string;
  /** Existing rule fields preserved verbatim */
  [key: string]: unknown;
  /** From getRuleMode(ruleId, resolvedPolicy) */
  ruleMode: 'blocking' | 'normative' | 'advisory' | 'off';
  /** From errorTaxonomy.getErrorEntryByRuleId(ruleId)?.sourceAuthority */
  sourceAuthority: string | null;
  /** From rulePackRegistry.findPackForRule(ruleId)?.id */
  pack: string | null;
}

export interface FlintRulesResourceBody {
  /** Domain → enriched rule list */
  [domainId: string]: EnrichedRule[] | unknown;
  /** Top-level: enabled packs from ResolvedPolicy */
  packs?: unknown;
}

/**
 * Violations URI parser.
 * Implementation: flint-mcp/src/server.ts (private helper)
 */
export type ParseViolationsUri = (
  uri: string,
  projectRoot: string
) => string | null;

// ─── Impact Map ─────────────────────────────────────────────────────

const impact: ImpactEntry[] = [
  {
    file: 'flint-mcp/src/tools/schemas.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Central Zod schema registry for all 59 MCP tools (D1)',
  },
  {
    file: 'flint-mcp/src/tools/handlers/audit.handler.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Extract flint_audit case body',
  },
  {
    file: 'flint-mcp/src/tools/handlers/fix.handler.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Extract flint_fix case body',
  },
  {
    file: 'flint-mcp/src/tools/handlers/migrateTw.handler.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Extract flint_migrate_tw case body',
  },
  {
    file: 'flint-mcp/src/tools/handlers/agentTrust.handler.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Extract flint_agent_trust case body',
  },
  {
    file: 'flint-mcp/src/tools/handlers/setPolicy.handler.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'Extract flint_set_policy case body; fix process.cwd()',
  },
  {
    file: 'flint-mcp/src/tools/handlers/types.ts',
    changeType: 'CREATE',
    owner: 'coder',
    summary: 'ResolvedToolContext + ToolHandler shared types',
  },
  {
    file: 'flint-mcp/src/server.ts',
    changeType: 'MODIFY',
    owner: 'coder',
    summary:
      'Validation hoist; projectRoot + resolved policy hoist; thin extracted cases; rules resource enrichment; violations URI fix; FULL D3 migration of 13 flintConfig.policy.* reads to ResolvedPolicy',
  },
  {
    file: 'flint-mcp/src/core/config.ts',
    changeType: 'MODIFY',
    owner: 'coder',
    summary: 'D3: Remove FlintConfig.policy field (slimmed to projectRoot + domains)',
  },
  {
    file: 'flint-mcp/src/core/config-loader.ts',
    changeType: 'MODIFY',
    owner: 'coder',
    summary: 'D3: loadConfig no longer calls toLegacyFlintPolicy; callers use loadAndResolvePolicy',
  },
  {
    file: 'flint-mcp/src/core/policyEngine.ts',
    changeType: 'MODIFY',
    owner: 'coder',
    summary: 'D3: DELETE toLegacyFlintPolicy export — all consumers migrated',
  },
  {
    file: 'flint-mcp/src/__tests__/policy-engine.test.ts',
    changeType: 'MODIFY',
    owner: 'flint-test-writer',
    summary: 'D3: Remove toLegacyFlintPolicy adapter describe block',
  },
  {
    file: 'flint-mcp/src/__tests__/server.set-policy.test.ts',
    changeType: 'MODIFY',
    owner: 'flint-test-writer',
    summary: 'D5: Regression test for invalid deltaE_threshold rejection via mergeAndValidatePolicy',
  },
  {
    file: 'flint-mcp/src/core/rulePackRegistry.ts',
    changeType: 'MODIFY',
    owner: 'flint-mcp-specialist',
    summary: 'Add findPackForRule(ruleId) reverse lookup',
  },
  {
    file: 'flint-mcp/src/__tests__/harness.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'RC3: MCP JSON-RPC synthetic CallToolRequest harness (~30 LOC)',
  },
  {
    file: 'flint-mcp/src/__tests__/server.zod-validation.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'Per-tool Zod schema rejection tests (uses harness)',
  },
  {
    file: 'flint-mcp/src/__tests__/server.rules-resource.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'flint://rules enrichment shape assertions',
  },
  {
    file: 'flint-mcp/src/__tests__/server.violations-uri.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'POSIX/Windows path parsing + sandbox',
  },
  {
    file: 'flint-mcp/src/__tests__/server.handler-extraction.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'Round-trip MCP JSON-RPC for 5 extracted handlers',
  },
  {
    file: 'flint-mcp/src/__tests__/server.flintconfig-resolved.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'flintConfig.resolvedPolicy populated after runServer',
  },
  {
    file: 'flint-mcp/src/tools/__tests__/rulePacks.zod.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary: 'Zod schema rejection tests for 5 rule pack tools',
  },
  {
    file: 'CLAUDE.md',
    changeType: 'MODIFY',
    owner: 'coder',
    summary: 'Remove stale "5 rule pack tools not yet registered" note',
  },
];

// ─── Test Boundaries ────────────────────────────────────────────────

const testBoundaries: TestBoundary[] = [
  {
    target: 'validateToolInput',
    kind: 'service',
    behavior: 'rejects malformed tool args before reaching handler body',
    assertion: "returns { ok: false, error: string } for missing required field",
    edgeCases: [
      'flint_audit with empty arguments',
      'flint_set_policy with action="bogus"',
      'flint_agent_trust with non-enum action',
      'flint_fix with filePath missing',
      'unknown tool name → passthrough (legacy cast)',
    ],
  },
  {
    target: 'parseViolationsUri',
    kind: 'service',
    behavior: 'normalizes flint://violations URIs across platforms and sandboxes to projectRoot',
    assertion: 'returns absolute path inside projectRoot, or null for traversal',
    edgeCases: [
      'POSIX absolute path inside project',
      'POSIX relative path resolved against projectRoot',
      'Windows-style /C:/foo/bar.tsx (mocked process.platform=win32)',
      '../../etc/passwd traversal → null',
      'URL-encoded spaces in filename',
      'absolute path outside projectRoot → null',
    ],
  },
  {
    target: 'flint://rules resource handler',
    kind: 'service',
    behavior: 'returns enriched rules with ruleMode, sourceAuthority, pack',
    assertion: 'every rule object includes the three new keys (some may be null)',
    edgeCases: [
      'known rule MITHRIL-COL has ruleMode === "blocking"',
      'rule with no errorTaxonomy entry → sourceAuthority: null',
      'rule with no rule pack → pack: null',
      'top-level packs section present',
    ],
  },
  {
    target: 'handleSetPolicy (extracted)',
    kind: 'service',
    behavior: 'rejects invalid update via mergeAndValidatePolicy and returns error',
    assertion: 'invalid deltaE_threshold → tool returns structured error, no disk write',
    edgeCases: [
      'action="read" returns ResolvedPolicy JSON',
      'action="update" with valid partial → writes and reloads',
      'action="update" with deltaE_threshold:-5 → rejected',
      'action="reset" restores defaults',
      'action="bogus" → structured error',
    ],
  },
  {
    target: 'handleAudit (extracted)',
    kind: 'service',
    behavior: 'audits a single file or batch and returns SARIF-shaped result',
    assertion: 'returns CallToolResult with content[0].text containing audit JSON',
    edgeCases: [
      'single-file happy path',
      'batch filePaths happy path',
      'missing source AND missing filePaths → error from Zod',
    ],
  },
  {
    target: 'handleFix (extracted)',
    kind: 'service',
    behavior: 'auto-fixes violations or returns dry-run preview',
    assertion: 'dry_run=true does not call FileTransactionManager',
    edgeCases: ['dry_run=true', 'dry_run=false applies fix', 'no violations → noop'],
  },
  {
    target: 'handleMigrateTw (extracted)',
    kind: 'service',
    behavior: 'migrates Tailwind v3 classes to v4',
    assertion: 'returns migration summary with classChanges count',
    edgeCases: ['file with v3 classes', 'file with no classes', 'invalid file path'],
  },
  {
    target: 'handleAgentTrust (extracted)',
    kind: 'service',
    behavior: 'profiles/promotes/demotes/resets/lists agent trust tiers',
    assertion: 'each action returns structured result',
    edgeCases: [
      'action=profile for unknown agent',
      'action=promote out of bounds',
      'action=demote below tier 0',
      'action=list returns array',
    ],
  },
  {
    target: 'rulePackRegistry.findPackForRule',
    kind: 'service',
    behavior: 'returns the pack containing a rule, or null',
    assertion: 'cached after first build',
    edgeCases: ['known rule', 'unknown rule → null', 'rule in multiple packs (returns first)'],
  },
  {
    target: 'D3 consumer migration — 13 sites in server.ts',
    kind: 'service',
    behavior: 'all flintConfig.policy.* reads replaced by resolved.* from loadAndResolvePolicy',
    assertion: 'grep of server.ts post-migration returns zero matches for flintConfig.policy.',
    edgeCases: [
      'line 1904 mithril deltaE_threshold → resolved.mithril.deltaE_threshold',
      'line 1905 mithril deltaE_critical_threshold → resolved.mithril.deltaE_critical_threshold',
      'line 1908 mithril.mode !== off → resolved.mithril.mode !== off',
      'line 1911 a11y.mode !== off → resolved.a11y.mode !== off',
      'line 2544 projectRoot → hoisted const',
      'line 2553 a11y.disabled_rules → filter resolved.a11y.rules where mode === off',
      'line 2554 mithril.mode === off → resolved.mithril.mode === off',
      'lines 2556/2565/2577/2627 projectRoot → hoisted',
      'line 2657 findProjectRoot fallback → projectRoot',
      'line 4268 flintConfig.domains → read at startup log (metadata, not policy)',
    ],
  },
  {
    target: 'toLegacyFlintPolicy removal',
    kind: 'service',
    behavior: 'export deleted from policyEngine.ts',
    assertion: 'TSC clean; policy-engine.test.ts adapter describe block removed',
    edgeCases: [
      'no import outside policyEngine.ts (verified via grep)',
      'override telemetry regression: advisory mode rules NOT logged as disabled',
    ],
  },
  {
    target: 'per-rule mode reaches override telemetry (D3 acceptance)',
    kind: 'service',
    behavior: 'flint_set_policy setting a rule to advisory does NOT record it as override; off does',
    assertion: 'round-trip via harness: set rule mode → flint_audit → query override telemetry',
    edgeCases: ['mode=blocking', 'mode=normative', 'mode=advisory', 'mode=off'],
  },
  {
    target: 'TOOL_INPUT_SCHEMAS coverage sanity',
    kind: 'service',
    behavior: 'every registered tool name has a Zod schema entry',
    assertion: 'TOOL_INPUT_SCHEMAS keys ⊇ tools/list response names',
    edgeCases: ['no orphaned schemas', 'no missing schemas'],
  },
];

// ─── Risks ──────────────────────────────────────────────────────────

const risks: RiskEntry[] = [
  {
    risk: 'D3 rewrites 13 server.ts consumer sites inside case bodies Group B will later extract — edit-order conflict',
    severity: 'medium',
    commandment: 6,
    mitigation:
      'Serialize: D3 rewrite is the first commit in Group B, before handler extraction. Extracted handlers receive resolved: ResolvedPolicy via ResolvedToolContext.',
  },
  {
    risk: 'toLegacyFlintPolicy removal breaks an import path not caught by grep',
    severity: 'low',
    mitigation:
      'Section 11 grep (electron/, src/, server/, flint-mcp/) returned only the policy-engine test as a consumer. TSC validates at approval time.',
  },
  {
    risk: 'Handler extraction breaks request/response shape due to implicit outer-scope captures',
    severity: 'medium',
    mitigation:
      'Pass everything via ResolvedToolContext. Per-handler integration tests in server.handler-extraction.test.ts.',
  },
  {
    risk: 'TOOL_INPUT_SCHEMAS diverges from JSON inputSchema declared on each tool',
    severity: 'medium',
    mitigation: 'Sanity test iterates registry and asserts coverage against tools/list.',
  },
  {
    risk: 'No existing MCP JSON-RPC test harness; flint-test-writer must build one',
    severity: 'medium',
    mitigation:
      'Build minimal harness invoking server._requestHandlers directly with synthetic CallToolRequest. Flag if SDK does not expose handlers.',
  },
  {
    risk: 'Glass/Electron consumers of flint://rules may break on enrichment',
    severity: 'medium',
    mitigation:
      'Enrichment is additive — old keys preserved. Grep electron/ and src/ for flint://rules consumers before merge.',
  },
  {
    risk: 'Sprint 4 spec inaccurate (rule pack registration and set-policy validation already shipped in Sprint 3)',
    severity: 'low',
    mitigation: 'Decisions D4/D5 explicitly reduce scope. Phase 1.5 contract linter to flag any redundant work.',
  },
  {
    risk: 'Windows URI test branch dead on POSIX CI',
    severity: 'low',
    mitigation: 'Stub process.platform via vitest spy.',
  },
  {
    risk: 'findPackForRule cold-start cost if eagerly built across 10 packs',
    severity: 'low',
    mitigation: 'Lazy build on first call; cache for process lifetime.',
  },
];

// ─── Full Contract ──────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'sprint-4-mcp-server',
    phase: 'SWEEP-S4',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-15',
  },
  impact,
  ipc: [],
  stores: [],
  components: [],
  commandments: [6, 14],
  testBoundaries,
  risks,
  parallelismGroups: {
    A: ['coder', 'flint-mcp-specialist', 'flint-test-writer'],
    B: ['coder', 'flint-test-writer'],
  },
  nonGoals: [
    'Extract handlers other than the 5 listed in D2',
    'Build-time validation of inputSchema vs Zod schemas',
    'Rename or restructure flint:// URI namespace',
    'Add new MCP tools or resources',
  ],
};
