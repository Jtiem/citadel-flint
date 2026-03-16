/**
 * BridgeConfig — bridge-mcp/src/core/config.ts
 *
 * Defines the shape and defaults for Bridge project configuration.
 * This includes both the general MCP server config (domains, project root)
 * and the policy engine settings (.bridge/policy.json).
 *
 * The policy schema gives each project control over governance thresholds,
 * linter modes, and export gate behaviour -- similar to how Snyk or ESLint
 * let organisations configure their own rule sets.
 */

// ── Policy types ─────────────────────────────────────────────────────────────

/**
 * Governance enforcement mode for a rule category.
 *
 *   blocking  — violations block export (current default behaviour)
 *   advisory  — violations show warnings but do not block export
 *   off       — rule category is disabled entirely
 */
export type PolicyMode = 'blocking' | 'advisory' | 'off'

/**
 * WCAG conformance levels. Controls which accessibility rules are active.
 */
export type A11yLevel = 'A' | 'AA' | 'AAA'

/**
 * The `.bridge/policy.json` schema.
 * Every field has a sensible default so a missing or partial file is safe.
 */
export interface BridgePolicy {
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
}

// ── General MCP config ──────────────────────────────────────────────────────

/**
 * BridgeConfig — the full configuration for a Bridge MCP server session.
 * Includes the project policy plus server-level settings.
 */
export interface BridgeConfig {
    /** Absolute path to the project root directory. */
    projectRoot: string
    /** Active governance domains. */
    domains: string[]
    /** The project policy (loaded from .bridge/policy.json). */
    policy: BridgePolicy
}

// ── Defaults ────────────────────────────────────────────────────────────────

/**
 * The default policy applied when no `.bridge/policy.json` exists.
 * Matches the pre-policy-engine hardcoded behaviour exactly.
 */
export const DEFAULT_POLICY: BridgePolicy = {
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
 * Default BridgeConfig used when no project root or config file is available.
 */
export const DEFAULT_CONFIG: BridgeConfig = {
    projectRoot: process.cwd(),
    domains: ['ui'],
    policy: { ...DEFAULT_POLICY },
}
