/**
 * Sprint 3 — Policy Engine Unification (Executable Contract)
 *
 * Status: DRAFT
 * Branch: fix/sprint-3-policy-engine
 * Spec:   docs/strategy/Unified_A+_Sweep_Complete_Work_Queue.md L127-152
 * Review: .flint-context/reviews/policy-mcp-aplus-review-2026-04-12.md
 *
 * Phase 2 agents MUST import the types below when implementing. Do not
 * redeclare these shapes inside implementation files.
 */

import type { FlintContract } from '../../shared/contract-schema'
import type {
    ResolvedPolicy,
    PolicyMode,
    RawPolicy,
} from '../../flint-mcp/src/core/policyEngine'
import type { ErrorEntry } from '../../flint-mcp/src/core/errorTaxonomy'

// ── errorTaxonomy.ts new surface ────────────────────────────────────────────

/**
 * Reverse index built at module init. Replaces O(n) lookup in
 * getErrorEntryByRuleId. MINOR-3 fix.
 */
export type ErrorTaxonomyByRuleId = Readonly<Record<string, ErrorEntry>>

/**
 * SYNC-001 / SYNC-002 taxonomy entries must be added to REGISTRY.
 * MINOR-10 fix. These ruleIds are emitted by the sync engine today but
 * have no entry, so users hitting them get no recovery guidance.
 */
export type SyncTaxonomyRuleIds = 'SYNC-001' | 'SYNC-002'

// ── config-loader.ts new surface ────────────────────────────────────────────

/**
 * New options bag for config loader. `strict: true` promotes validation
 * warnings to thrown errors (used by flint-ci). Default is permissive to
 * preserve existing runtime behavior.
 *
 * MAJOR-2 fix.
 */
export interface ConfigLoaderOptions {
    /** Fail loudly on any validateProjectConfig error. Default: false. */
    strict?: boolean
    /**
     * Optional project root override. Defaults to resolveProjectRoot().
     * Allows flint-ci and server.ts to pin the correct root.
     */
    projectRoot?: string
}

/**
 * New overload — same signature callers use today, plus the options bag.
 * Existing signature (projectRoot: string) remains backward-compatible.
 */
export type LoadConfigFn = (
    projectRoot: string,
    options?: ConfigLoaderOptions,
) => import('../../flint-mcp/src/core/config').FlintConfig

/**
 * Path-sandbox contract for resolveExtendsRef. MAJOR-3 fix.
 *
 * Rules:
 *   - Relative paths (./, ../) must resolve INSIDE projectRoot after
 *     path.resolve + fs.realpathSync canonicalization.
 *   - Absolute paths are rejected unless the ref matches a preset file
 *     inside PRESETS_DIR.
 *   - Any path containing `..` segments that escape projectRoot throws
 *     a `ConfigPathSandboxError`.
 */
export class ConfigPathSandboxError extends Error {
    readonly code = 'FLINT_CONFIG_PATH_SANDBOX' as const
    constructor(
        readonly attemptedRef: string,
        readonly resolvedPath: string,
    ) {
        super(
            `[Flint Config] extends path '${attemptedRef}' resolves outside projectRoot: ${resolvedPath}`,
        )
    }
}

// ── policyEngine.ts new surface ─────────────────────────────────────────────

/**
 * Unified loader — the sole runtime entrypoint after Sprint 3.
 * Replaces policyLoader.readPolicy + config-loader.loadPolicy duplication.
 *
 * Returns v2 ResolvedPolicy. Callers that need legacy FlintPolicy use
 * `toLegacyFlintPolicy(resolved)` adapter below.
 *
 * CRIT-1 + CRIT-3 fix.
 */
export type LoadAndResolvePolicyFn = (
    projectRoot: string,
    options?: {
        teamId?: string
        strict?: boolean
    },
) => ResolvedPolicy

/**
 * Writes a ResolvedPolicy back to .flint/policy.json atomically.
 * Replaces policyLoader.writePolicy. Accepts ResolvedPolicy (v2 shape).
 */
export type WriteResolvedPolicyFn = (
    projectRoot: string,
    policy: ResolvedPolicy,
) => void

/**
 * Partial-update helper that round-trips through validatePolicy.
 * Replaces policyLoader.mergePolicy. MAJOR-6 fix: guarantees no invalid
 * policy can be written via flint_set_policy.
 *
 * Returns { ok: true, policy } on success or { ok: false, errors } when
 * the merged result fails validation. MCP caller surfaces errors to user.
 */
export type MergeAndValidatePolicyFn = (
    projectRoot: string,
    partial: Partial<RawPolicy>,
) =>
    | { ok: true; policy: ResolvedPolicy }
    | { ok: false; errors: string[] }

/**
 * Default policy accessor. Replaces policyLoader.getDefaultPolicy.
 * Returns a fresh clone of DEFAULT_RESOLVED_POLICY.
 */
export type GetDefaultResolvedPolicyFn = () => ResolvedPolicy

/**
 * Legacy adapter — converts ResolvedPolicy (v2) back into FlintPolicy (v1)
 * shape so the current `flintConfig` reload path (server.ts:2811) keeps
 * working. This is the bridge that lets us delete policyLoader without
 * breaking the rest of the server handler surface in one sprint.
 *
 * Sprint 4 will delete this adapter when downstream consumers are rewritten
 * to read ResolvedPolicy directly.
 */
export type ToLegacyFlintPolicyFn = (
    resolved: ResolvedPolicy,
) => import('../../flint-mcp/src/core/config').FlintPolicy

// ── configValidator.ts expanded surface ─────────────────────────────────────

/**
 * New validation coverage targets. MAJOR-1 fix.
 *
 * Every section listed below must produce at least one targeted error
 * message when the input is malformed. Tests in configValidator.test.ts
 * must cover each section with a bad-input case.
 */
export type ExpandedValidationSections =
    | 'rules.export_gate'
    | 'rules.baseline'
    | 'environments'           // recursive
    | 'trust.profiles'
    | 'trust.approval'
    | 'trust.escalation'
    | 'enforcement'

// ── KNOWN_*_RULES derivation contract (CRIT-2) ──────────────────────────────

/**
 * policyEngine.ts must derive KNOWN_MITHRIL_RULES and KNOWN_A11Y_RULES
 * from errorTaxonomy.REGISTRY at module init — not hardcoded lists.
 *
 * Implementation contract:
 *   - Import getAllErrors() or REGISTRY from errorTaxonomy
 *   - Filter by category === 'mithril' / 'accessibility'
 *   - Build `ReadonlySet<string>` of ruleIds
 *   - No manual ruleId literals remain in policyEngine.ts
 */
export interface KnownRulesDerivation {
    readonly KNOWN_MITHRIL_RULES: ReadonlySet<string>
    readonly KNOWN_A11Y_RULES: ReadonlySet<string>
}

// ── Contract metadata ───────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'sprint-3-policy-engine',
        phase: 'A+ Sweep Sprint 3',
        status: 'APPROVED',
        date: '2026-04-14',
        owner: 'flint-architect',
    },
    impact: [
        {
            file: 'flint-mcp/src/core/policyLoader.ts',
            changeType: 'DELETE',
            owner: 'coder',
            summary: 'CRIT-3 triple-loader elimination — delete policyLoader.ts entirely',
        },
        {
            file: 'flint-mcp/src/core/policyEngine.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'CRIT-2 derive KNOWN_*_RULES from errorTaxonomy, MAJOR-8 clean SEVERITY_RANK, MINOR-9 validate rawMode, MINOR-11 drop disabled_rules, export new unified loader surface (loadAndResolvePolicy, writeResolvedPolicy, mergeAndValidatePolicy, getDefaultResolvedPolicy, toLegacyFlintPolicy)',
        },
        {
            file: 'flint-mcp/src/core/config-loader.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'MAJOR-2 strict option, MAJOR-3 path sandbox via ConfigPathSandboxError, MAJOR-4 realpathSync canonicalization, MINOR-2 deep-merge trust.profiles, MINOR-8 structured config-validation event',
        },
        {
            file: 'flint-mcp/src/core/configValidator.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'MAJOR-1 validate export_gate, environments (recursive), trust.profiles, trust.approval, trust.escalation, enforcement sections',
        },
        {
            file: 'flint-mcp/src/core/errorTaxonomy.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'MINOR-3 BY_RULE_ID reverse index (CRIT-2 dependency), MINOR-10 add SYNC-001/SYNC-002 entries',
        },
        {
            file: 'flint-mcp/src/server.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'Redirect flint_set_policy callers from policyLoader → policyEngine unified surface. MAJOR-6 route through mergeAndValidatePolicy.',
        },
        {
            file: 'flint-mcp/src/__tests__/policy-engine.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary: 'Update imports + assertions to new policyEngine surface. Expand KNOWN_*_RULES coverage tests.',
        },
        {
            file: 'flint-mcp/src/__tests__/server.set-policy.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'New MCP integration test suite for flint_set_policy covering CRIT-1 (validated writes) + CRIT-3 (unified loader) + MAJOR-6 (reject invalid payload) + strict mode + path sandbox behavior through the tool handler',
        },
        {
            file: 'flint-mcp/src/core/__tests__/config-loader.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'New unit test suite covering MAJOR-2 strict mode + MAJOR-3 path sandbox (ConfigPathSandboxError on traversal) + MAJOR-4 realpathSync canonicalization dedupe + MINOR-2 trust.profiles deep merge',
        },
    ],
    testBoundaries: [
        {
            target: 'loadAndResolvePolicy',
            kind: 'service',
            behavior: 'Loads policy from .flint/policy.json and returns a validated ResolvedPolicy',
            assertion: 'returns ResolvedPolicy',
            edgeCases: ['missing file returns DEFAULT_RESOLVED_POLICY clone', 'malformed JSON throws with actionable message', 'v1 RawPolicy shape is migrated to v2'],
        },
        {
            target: 'loadAndResolvePolicy',
            kind: 'service',
            behavior: 'Loads policy from flint.config.yaml when policy.json is absent',
            assertion: 'returns ResolvedPolicy',
            edgeCases: ['yaml takes precedence when both exist per Sprint 3 spec', 'extends chain resolves via path sandbox'],
        },
        {
            target: 'loadAndResolvePolicy',
            kind: 'service',
            behavior: 'Strict mode promotes validation warnings to thrown errors',
            assertion: 'throws Error when strict:true and validateProjectConfig returns errors',
            edgeCases: ['strict:false preserves permissive default', 'strict:true with valid input returns ResolvedPolicy'],
        },
        {
            target: 'mergeAndValidatePolicy',
            kind: 'service',
            behavior: 'Rejects invalid deltaE_threshold before writing to disk',
            assertion: 'returns { ok: false, errors: string[] }',
            edgeCases: ['negative deltaE', 'non-numeric deltaE', 'deltaE above 100'],
        },
        {
            target: 'mergeAndValidatePolicy',
            kind: 'service',
            behavior: 'Rejects unknown ruleId in a11y.rules map',
            assertion: 'returns { ok: false, errors: string[] } listing unknown ruleId',
            edgeCases: ['empty rules map returns ok:true', 'mithril rules map is validated identically'],
        },
        {
            target: 'KNOWN_MITHRIL_RULES',
            kind: 'service',
            behavior: 'Derived at module init from errorTaxonomy REGISTRY, contains all MITHRIL-IST-* and MITHRIL-TW-* ruleIds',
            assertion: 'ReadonlySet<string> with size > 0 and all entries having mithril category',
            edgeCases: ['no manual ruleId literals remain in policyEngine.ts source', 'new taxonomy entries appear without code changes'],
        },
        {
            target: 'KNOWN_A11Y_RULES',
            kind: 'service',
            behavior: 'Derived at module init from errorTaxonomy REGISTRY, contains A11Y-011 through A11Y-103',
            assertion: 'ReadonlySet<string> with size > 0 and all entries having accessibility category',
            edgeCases: ['filter correctly excludes non-a11y categories'],
        },
        {
            target: 'SEVERITY_RANK',
            kind: 'service',
            behavior: 'MAJOR-8 — advisory key removed from SEVERITY_RANK map',
            assertion: 'typeof SEVERITY_RANK.advisory === "undefined"',
            edgeCases: ['off/warn/error keys remain', 'comparator still orders error > warn > off'],
        },
        {
            target: 'coerceToResolved',
            kind: 'service',
            behavior: 'MINOR-9 — rejects bogus rawMode value instead of silently defaulting',
            assertion: 'throws or logs structured error when rawMode is not in allowed set',
            edgeCases: ['undefined rawMode falls back to default', 'typo like "erorr" is rejected not silently coerced'],
        },
        {
            target: 'loadConfig',
            kind: 'service',
            behavior: 'MAJOR-2 — strict mode throws on validation error',
            assertion: 'throws Error with all validator messages joined',
            edgeCases: ['strict:false warns but returns partial config', 'projectRoot override is honored'],
        },
        {
            target: 'resolveExtendsRef',
            kind: 'service',
            behavior: 'MAJOR-3 — rejects path traversal outside projectRoot',
            assertion: 'throws ConfigPathSandboxError for ../../../etc/passwd style refs',
            edgeCases: ['absolute paths outside PRESETS_DIR are rejected', 'symlink escapes are caught post-realpathSync', 'legitimate relative refs inside projectRoot succeed'],
        },
        {
            target: 'resolveExtendsRef',
            kind: 'service',
            behavior: 'MAJOR-4 — canonicalizes via realpathSync to dedupe extends chain',
            assertion: 'returns realpath of resolved ref',
            edgeCases: ['symlinked preset file resolves to real path', 'already-canonical paths are idempotent'],
        },
        {
            target: 'deepMergeConfigs',
            kind: 'service',
            behavior: 'MINOR-2 — merges trust.profiles per-id rather than replacing the array',
            assertion: 'merged profiles array contains union keyed by profile id',
            edgeCases: ['overlapping profile id: child overrides parent fields', 'disjoint profile ids preserved from both sides'],
        },
        {
            target: 'validateProjectConfig',
            kind: 'service',
            behavior: 'MAJOR-1 — catches bad export_gate.block_on_overrides type',
            assertion: 'returns errors array including export_gate path',
            edgeCases: ['string where boolean expected', 'missing key treated as default'],
        },
        {
            target: 'validateProjectConfig',
            kind: 'service',
            behavior: 'MAJOR-1 — recursively validates environments.<env>.rules',
            assertion: 'returns errors for nested environment rule map',
            edgeCases: ['multiple env entries', 'deeply nested invalid rule mode'],
        },
        {
            target: 'validateProjectConfig',
            kind: 'service',
            behavior: 'MAJOR-1 — catches bad trust.profiles[].tier',
            assertion: 'returns errors with trust.profiles[n].tier path',
            edgeCases: ['tier as unknown string', 'tier as number'],
        },
        {
            target: 'validateProjectConfig',
            kind: 'service',
            behavior: 'MAJOR-1 — catches bad enforcement.mode',
            assertion: 'returns errors with enforcement.mode path',
            edgeCases: ['enforcement.mode as invalid enum value', 'enforcement section missing'],
        },
        {
            target: 'getErrorEntryByRuleId',
            kind: 'service',
            behavior: 'MINOR-3 — O(1) BY_RULE_ID lookup returns SYNC-001 entry',
            assertion: 'returns ErrorEntry with ruleId "SYNC-001"',
            edgeCases: ['unknown ruleId returns undefined', 'case sensitivity preserved'],
        },
        {
            target: 'getErrorEntryByRuleId',
            kind: 'service',
            behavior: 'MINOR-10 — SYNC-002 entry exists and is retrievable',
            assertion: 'returns ErrorEntry with ruleId "SYNC-002"',
            edgeCases: ['both SYNC entries have non-empty recovery text'],
        },
        {
            target: 'flint_set_policy (update)',
            kind: 'ipc-handler',
            behavior: 'MAJOR-6 — rejects invalid payload via mergeAndValidatePolicy',
            assertion: 'MCP tool response content includes error list, disk file unchanged',
            edgeCases: ['invalid deltaE_threshold', 'unknown ruleId', 'malformed nested shape'],
        },
        {
            target: 'flint_set_policy (read)',
            kind: 'ipc-handler',
            behavior: 'CRIT-1 — returns ResolvedPolicy shape (v2) via unified loader',
            assertion: 'parsed response matches ResolvedPolicy type',
            edgeCases: ['fresh project returns default', 'v1 on-disk policy is migrated on read'],
        },
        {
            target: 'flint_set_policy (reset)',
            kind: 'ipc-handler',
            behavior: 'CRIT-3 — writes DEFAULT_RESOLVED_POLICY via unified loader',
            assertion: 'on-disk policy.json equals serialized DEFAULT_RESOLVED_POLICY',
            edgeCases: ['pre-existing custom policy is overwritten', 'missing .flint directory is created'],
        },
    ],
    ipc: [],
    stores: [],
    components: [],
    commandments: [6, 14],
    risks: [
        {
            risk: 'Shape drift — policyLoader returns v1 FlintPolicy while policyEngine returns v2 ResolvedPolicy; flint_set_policy public response shape changes when redirected',
            severity: 'high',
            commandment: 6,
            mitigation: 'Ship toLegacyFlintPolicy() adapter and emit ResolvedPolicy directly from server.ts — MCP surface is internal, no external spec pinned to v1',
        },
        {
            risk: 'flintConfig reload path — server.ts:2811 calls loadConfig after every policy update, which internally uses v1 config-loader.loadPolicy',
            severity: 'medium',
            commandment: 6,
            mitigation: 'Keep loadConfig working via legacy adapter for Sprint 3; Sprint 4 migrates flintConfig to ResolvedPolicy',
        },
        {
            risk: 'Test import cascade — policy-engine.test.ts currently imports from policyLoader and will break compilation mid-sprint when policyLoader is deleted',
            severity: 'low',
            mitigation: 'Rewrite test imports to new policyEngine surface in the same commit that deletes policyLoader.ts',
        },
    ],
    parallelismGroups: {
        A: ['coder', 'flint-test-writer'],
    },
    nonGoals: [
        'No new MCP tools (Sprint 4 territory)',
        'No new IPC channels',
        'No new Zustand stores',
        'No new Glass UI components',
        'No refactor of CallToolRequestSchema mega-switch (MINOR-5, separate sprint)',
        'No Zod runtime validation on tool args (MAJOR-5, Sprint 4)',
        'No refactor of flintConfig type to ResolvedPolicy (Sprint 4)',
        'No violations URI path sandbox (MINOR-7, Sprint 4)',
    ],
}
