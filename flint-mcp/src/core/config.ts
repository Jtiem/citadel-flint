/**
 * FlintConfig — flint-mcp/src/core/config.ts
 *
 * Defines the shape and defaults for Flint project configuration.
 * This includes both the general MCP server config (domains, project root)
 * and the policy engine settings (.flint/policy.json).
 *
 * The policy schema gives each project control over governance thresholds,
 * linter modes, and export gate behaviour -- similar to how Snyk or ESLint
 * let organisations configure their own rule sets.
 */

// ── Policy types ─────────────────────────────────────────────────────────────

/**
 * Governance enforcement mode for a rule category.
 *
 *   blocking  — violations block export, cannot be overridden (coercive)
 *   normative — violations block export (configurable), auto-fixable, overridable
 *   advisory  — violations show warnings but do not block export
 *   off       — rule category is disabled entirely
 *
 * UCFG.3: 'normative' added as the middle ground between blocking and advisory.
 * Downstream linters treat normative the same as blocking (violations are detected).
 * The distinction matters for: auto-fix eligibility, override permissions, and
 * export gate configurability via block_on settings.
 */
export type PolicyMode = 'blocking' | 'normative' | 'advisory' | 'off'

/**
 * WCAG conformance levels. Controls which accessibility rules are active.
 */
export type A11yLevel = 'A' | 'AA' | 'AAA'

/**
 * Industry governance domain. Controls which sentinel preset is active.
 * Matches the domain presets in flint-mcp/src/prompts/sentinel.ts.
 */
export type GovernanceDomain =
    | 'general'
    | 'healthcare'
    | 'fintech'
    | 'e-commerce'
    | 'government'
    | 'enterprise-saas'

/**
 * The `.flint/policy.json` schema.
 * Every field has a sensible default so a missing or partial file is safe.
 */
export interface FlintPolicy {
    /** Schema version. Must be 1. */
    version: number

    /** Mithril design system linter settings. */
    mithril: {
        /** ΔE threshold for amber-level violations (default 2.0). */
        deltaE_threshold: number
        /** ΔE threshold for critical-level violations (default 10.0). */
        deltaE_critical_threshold: number
        /** Enforcement mode for Mithril violations. */
        mode: PolicyMode
        /** Glob patterns for files to exclude from Mithril linting. */
        ignore_patterns: string[]
    }

    /** Accessibility linter settings. */
    a11y: {
        /** WCAG conformance level to enforce. */
        level: A11yLevel
        /** Enforcement mode for accessibility violations. */
        mode: PolicyMode
        /** Rule IDs to disable (e.g. ['A11Y-006']). */
        disabled_rules: string[]
    }

    /** Export gate settings — controls what blocks export. */
    export_gate: {
        /** Whether Mithril violations block export. */
        block_on_mithril: boolean
        /** Whether accessibility violations block export. */
        block_on_a11y: boolean
        /** Whether component overrides block export. */
        block_on_overrides: boolean
    }

    /** Baseline settings for suppressing known violations. */
    baseline: {
        /** Whether baseline suppression is enabled. */
        enabled: boolean
    }

    /**
     * Industry governance domain. Controls which sentinel preset is active.
     * When set, the Flint Sentinel prompt and AI Orchestrator will inject
     * domain-specific compliance rules (HIPAA, PCI-DSS, Section 508, SOC 2, etc.)
     * into the agent context.
     *
     * Defaults to undefined (resolves to "general" in the sentinel).
     */
    domain?: GovernanceDomain
}

// ── General MCP config ──────────────────────────────────────────────────────

/**
 * FlintConfig — the full configuration for a Flint MCP server session.
 * Includes the project policy plus server-level settings.
 */
export interface FlintConfig {
    /** Absolute path to the project root directory. */
    projectRoot: string
    /** Active governance domains. */
    domains: string[]
    /** The project policy (loaded from .flint/policy.json). */
    policy: FlintPolicy
}

// ── Defaults ────────────────────────────────────────────────────────────────

/**
 * The default policy applied when no `.flint/policy.json` exists.
 * Matches the pre-policy-engine hardcoded behaviour exactly.
 */
export const DEFAULT_POLICY: FlintPolicy = {
    version: 1,
    mithril: {
        deltaE_threshold: 2.0,
        deltaE_critical_threshold: 10.0,
        mode: 'blocking',
        ignore_patterns: ['**/node_modules/**'],
    },
    a11y: {
        level: 'AA',
        mode: 'blocking',
        disabled_rules: [],
    },
    export_gate: {
        block_on_mithril: true,
        block_on_a11y: true,
        block_on_overrides: true,
    },
    baseline: {
        enabled: false,
    },
}

/**
 * Default FlintConfig used when no project root or config file is available.
 */
export const DEFAULT_CONFIG: FlintConfig = {
    projectRoot: process.cwd(),
    domains: ['ui'],
    policy: { ...DEFAULT_POLICY },
}

// ── Unified Config types (UCFG.1) ──────────────────────────────────────────
// These types represent the flint.config.yaml schema.
// The loader parses YAML into FlintProjectConfig, then maps it to FlintPolicy
// so all downstream consumers are unaffected.

/**
 * Three-mode rule taxonomy (from GaaS/GUARDIAN research).
 *
 *   coercive  — Non-negotiable. Blocks export. Cannot be overridden.
 *   normative — Standard enforcement. Auto-fixable. Overridable with justification.
 *   advisory  — Best-practice guidance. Informational only.
 *   off       — Rule category disabled.
 */
export type RuleMode = 'coercive' | 'normative' | 'advisory' | 'off'

/**
 * Named trust tiers (from CSA Agentic Trust Framework).
 * More intuitive than untrusted/standard/elevated/admin.
 *
 *   intern    — Observe only. Can audit, read, query.
 *   junior    — Can recommend fixes. Cannot mutate.
 *   senior    — Can fix with guardrails. Structural changes need approval.
 *   principal — Full autonomy within project scope.
 */
export type TrustTier = 'intern' | 'junior' | 'senior' | 'principal'

/** Legacy trust tier names — accepted during migration. */
export type LegacyTrustTier = 'untrusted' | 'standard' | 'elevated' | 'admin'

/**
 * Data classification (from Agent Format spec).
 * Scopes governance strictness per project.
 */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted'

/** Comparison operators for conditional approval gates. */
export interface ConditionOperator {
    gt?: number
    gte?: number
    lt?: number
    lte?: number
    eq?: number
    ne?: number
}

/** External governance policy reference (from Agent Format spec). */
export interface PolicyRef {
    ref: string
    required?: boolean
    description?: string
}

/** Conditional approval gate for risk-based mutation approval. */
export interface ApprovalGate {
    condition: Record<string, ConditionOperator>
    action: 'require_approval' | 'auto_approve' | 'escalate'
    message?: string
}

/** Escalation trigger in YAML config. */
export interface YamlEscalationRule {
    when: Record<string, string | number>
    then: string
    to?: string
    message?: string
}

/** Agent profile in YAML config. */
export interface YamlAgentProfile {
    id: string
    name?: string
    tier?: TrustTier | LegacyTrustTier
    max_mutations?: number
    require_review?: boolean
}

/** Trust promotion gates. */
export interface PromotionGates {
    clean_sessions?: number
    security_validation?: boolean
    governance_signoff?: boolean
}

/**
 * FlintProjectConfig — the flint.config.yaml schema.
 *
 * Parsed from YAML, then mapped to FlintPolicy for backward compatibility.
 * All fields are optional except `project`.
 */
export interface FlintProjectConfig {
    schema_version?: string
    project: string
    domain?: GovernanceDomain
    classification?: DataClassification
    labels?: Record<string, string>

    extends?: string[]
    tighten_only?: boolean

    tokens?: {
        source?: string
        library?: 'auto' | 'primeng' | 'shadcn' | 'mui' | 'tailwind' | 'none'
        figma?: {
            file_key?: string | null
            component_library?: string | null
            icon_library?: string | null
        }
    }

    rules?: {
        mithril?: {
            mode?: RuleMode
            delta_e?: number
            delta_e_critical?: number
            ignore?: string[]
        }
        accessibility?: {
            level?: A11yLevel
            mode?: RuleMode
            disabled?: string[]
        }
        export_gate?: {
            block_on?: RuleMode
            warn_on?: RuleMode
            block_on_overrides?: boolean
            block_on_mithril?: boolean
            block_on_a11y?: boolean
        }
        baseline?: { enabled?: boolean }
        policies?: PolicyRef[]
    }

    scoring?: {
        weights?: {
            coercive?: number
            normative?: number
            advisory?: number
            recency?: number
        }
        presets?: Record<string, Record<string, number>>
    }

    trust?: {
        default_tier?: TrustTier | LegacyTrustTier
        allow_demotion?: boolean
        profiles?: YamlAgentProfile[]
        approval?: ApprovalGate[]
        escalation?: YamlEscalationRule[]
        promotion?: PromotionGates
    }

    enforcement?: {
        decision_points?: string[]
        points?: Record<string, Record<string, string | string[]>>
    }

    review?: {
        consensus?: boolean | { domains?: string[]; threshold?: number }
    }

    content?: {
        style_guide?: string | null
    }

    audit?: {
        retention?: string
        export?: string[]
    }

    environments?: Record<string, Partial<FlintProjectConfig>>
}

// ── Mode & Tier mapping ────────────────────────────────────────────────────

/** Map RuleMode → PolicyMode. */
export function ruleModeToPolicy(mode: RuleMode): PolicyMode {
    switch (mode) {
        case 'coercive':
            return 'blocking'
        case 'normative':
            return 'normative'
        case 'advisory':
            return 'advisory'
        case 'off':
            return 'off'
        default:
            return 'blocking'
    }
}

/** Map PolicyMode → RuleMode for YAML export. */
export function policyToRuleMode(mode: PolicyMode): RuleMode {
    switch (mode) {
        case 'blocking':
            return 'coercive'
        case 'normative':
            return 'normative'
        case 'advisory':
            return 'advisory'
        case 'off':
            return 'off'
        default:
            return 'coercive'
    }
}

/** Map TrustTier → legacy tier name. */
const TRUST_TO_LEGACY: Record<TrustTier, string> = {
    intern: 'untrusted',
    junior: 'standard',
    senior: 'elevated',
    principal: 'admin',
}

/** Map legacy tier → TrustTier. */
const LEGACY_TO_TRUST: Record<LegacyTrustTier, TrustTier> = {
    untrusted: 'intern',
    standard: 'junior',
    elevated: 'senior',
    admin: 'principal',
}

/** Normalize any tier name (new or legacy) to TrustTier. */
export function normalizeTrustTier(tier: string): TrustTier {
    if (tier in LEGACY_TO_TRUST) {
        return LEGACY_TO_TRUST[tier as LegacyTrustTier]
    }
    if (tier in TRUST_TO_LEGACY) {
        return tier as TrustTier
    }
    return 'junior' // safe default
}

/** Convert TrustTier to legacy tier name for downstream consumers. */
export function trustTierToLegacy(tier: TrustTier): string {
    return TRUST_TO_LEGACY[tier] ?? 'standard'
}

/**
 * Map a FlintProjectConfig (from YAML) to a FlintPolicy (for downstream consumers).
 * This is the core bridge between the new config format and existing code.
 */
export function projectConfigToPolicy(config: FlintProjectConfig): FlintPolicy {
    const rules = config.rules ?? {}
    const mithril = rules.mithril ?? {}
    const a11y = rules.accessibility ?? {}
    const gate = rules.export_gate ?? {}

    // Runtime type guards — YAML parse returns unknown, so validate critical fields
    const num = (v: unknown, fallback: number): number =>
        typeof v === 'number' && !Number.isNaN(v) ? v : fallback
    const bool = (v: unknown, fallback: boolean): boolean =>
        typeof v === 'boolean' ? v : fallback

    return {
        version: 1,
        mithril: {
            deltaE_threshold: num(mithril.delta_e, DEFAULT_POLICY.mithril.deltaE_threshold),
            deltaE_critical_threshold: num(
                mithril.delta_e_critical,
                DEFAULT_POLICY.mithril.deltaE_critical_threshold
            ),
            mode: mithril.mode ? ruleModeToPolicy(mithril.mode) : DEFAULT_POLICY.mithril.mode,
            ignore_patterns: Array.isArray(mithril.ignore)
                ? mithril.ignore
                : DEFAULT_POLICY.mithril.ignore_patterns,
        },
        a11y: {
            level: a11y.level ?? DEFAULT_POLICY.a11y.level,
            mode: a11y.mode ? ruleModeToPolicy(a11y.mode) : DEFAULT_POLICY.a11y.mode,
            disabled_rules: Array.isArray(a11y.disabled)
                ? a11y.disabled
                : DEFAULT_POLICY.a11y.disabled_rules,
        },
        export_gate: {
            // block_on (RuleMode) and warn_on (RuleMode) are reserved for UCFG.3
            // when full coercive/normative/advisory semantics land. Currently unused.
            block_on_mithril: bool(
                gate.block_on_mithril,
                DEFAULT_POLICY.export_gate.block_on_mithril
            ),
            block_on_a11y: bool(gate.block_on_a11y, DEFAULT_POLICY.export_gate.block_on_a11y),
            block_on_overrides: bool(
                gate.block_on_overrides,
                DEFAULT_POLICY.export_gate.block_on_overrides
            ),
        },
        baseline: {
            enabled: bool(rules.baseline?.enabled, DEFAULT_POLICY.baseline.enabled),
        },
        domain: config.domain,
    }
}
