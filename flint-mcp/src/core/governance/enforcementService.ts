/**
 * EnforcementService — flint-mcp/src/core/governance/enforcementService.ts
 *
 * Policy Decision Point (PDP) and Policy Enforcement Point (PEP) services.
 *
 * Reads the `enforcement` section of flint.config.yaml and makes it
 * actionable. Two concerns are combined here intentionally — both are
 * pure functions over the same data shape and keeping them together
 * prevents unnecessary module proliferation.
 *
 * PDP (resolveEnforcement / getActiveModesForDecisionPoint):
 *   Answers "which rules are active at this decision point?"
 *
 * PEP (getEnforcementAction):
 *   Answers "what action should I take for this violation at this point?"
 *
 * Default behaviour matches the pre-UCFG hardcoded policy exactly so that
 * projects without an enforcement section get the same results they always did.
 *
 * Phase: Gap 7 — PDP/PEP enforcement point services
 */

import type { FlintProjectConfig, RuleMode } from '../config.js'

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Resolved enforcement configuration derived from flint.config.yaml.
 * All fields are fully hydrated — callers never need to guard for undefined.
 */
export interface ResolvedEnforcement {
    /**
     * Decision point → the rule modes that are active at that point.
     * Key is the decision point name (e.g. "mcp_audit", "export_gate", "ci_gate").
     * Value is the list of non-off modes that should be evaluated.
     */
    decisionPoints: Record<string, RuleMode[]>

    /**
     * Enforcement point → the action to take for each rule mode bucket.
     * Key is the enforcement point name (e.g. "export_gate", "auto_fix", "ci_gate").
     */
    points: Record<string, EnforcementPointConfig>
}

export interface EnforcementPointConfig {
    /** Modes that cause a hard block (export blocked, CI fails). */
    blockOn: RuleMode[]
    /** Modes that emit a warning but do not block. */
    warnOn: RuleMode[]
    /** Modes eligible for automatic remediation. */
    autoFixOn: RuleMode[]
}

// ── Default enforcement (backward-compatible) ─────────────────────────────────

/**
 * Default decision points — all non-off modes are active everywhere.
 * Matches pre-UCFG behaviour where every violation was considered.
 */
const DEFAULT_ACTIVE_MODES: RuleMode[] = ['coercive', 'normative', 'advisory']

/**
 * Default enforcement points — matches pre-UCFG hardcoded policy:
 *   export_gate: blocks on coercive + normative (was block_on_mithril + block_on_a11y = true)
 *   auto_fix:    applies on normative (Mithril violations were auto-fixable)
 *   ci_gate:     fails on coercive, warns on normative (pre-UCFG CI behaviour)
 *   mcp_audit:   warns on everything (audit never blocked, just reported)
 */
const DEFAULT_ENFORCEMENT_POINTS: Record<string, EnforcementPointConfig> = {
    export_gate: {
        blockOn: ['coercive', 'normative'],
        warnOn: ['advisory'],
        autoFixOn: [],
    },
    auto_fix: {
        blockOn: [],
        warnOn: ['advisory'],
        autoFixOn: ['normative'],
    },
    ci_gate: {
        blockOn: ['coercive'],
        warnOn: ['normative', 'advisory'],
        autoFixOn: [],
    },
    mcp_audit: {
        blockOn: [],
        warnOn: ['coercive', 'normative', 'advisory'],
        autoFixOn: [],
    },
}

/** Full default — used when no enforcement section exists in the YAML config. */
const DEFAULT_RESOLVED_ENFORCEMENT: ResolvedEnforcement = {
    decisionPoints: {
        mcp_audit: [...DEFAULT_ACTIVE_MODES],
        export_gate: [...DEFAULT_ACTIVE_MODES],
        ci_gate: [...DEFAULT_ACTIVE_MODES],
        auto_fix: [...DEFAULT_ACTIVE_MODES],
    },
    points: { ...DEFAULT_ENFORCEMENT_POINTS },
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

/** Normalise a YAML value that may be a single string or an array of strings. */
function parseRuleModeList(value: string | string[] | undefined): RuleMode[] {
    if (!value) return []
    const raw = Array.isArray(value) ? value : [value]
    // Validate: only keep known RuleMode values, skip unknown strings
    const valid: RuleMode[] = ['coercive', 'normative', 'advisory', 'off']
    return raw.filter((v): v is RuleMode => valid.includes(v as RuleMode))
}

/**
 * Parse a single enforcement point record from the YAML config.
 * Supports both the flat map shape from the spec:
 *   block_on: coercive
 *   warn_on: [normative, advisory]
 *   apply_on: normative
 */
function parseEnforcementPoint(
    raw: Record<string, string | string[]>
): EnforcementPointConfig {
    return {
        blockOn: parseRuleModeList(raw['block_on']),
        warnOn: parseRuleModeList(raw['warn_on']),
        autoFixOn: parseRuleModeList(raw['apply_on']),
    }
}

// ── PDP: resolveEnforcement ───────────────────────────────────────────────────

/**
 * Resolves enforcement configuration from a FlintProjectConfig.
 *
 * When no enforcement section exists (or config is undefined), returns
 * DEFAULT_RESOLVED_ENFORCEMENT which is backward-compatible with the
 * pre-UCFG hardcoded policy.
 *
 * The returned object is always fully hydrated — callers never need
 * to guard for missing keys.
 */
export function resolveEnforcement(
    config?: FlintProjectConfig
): ResolvedEnforcement {
    const enforcementSection = config?.enforcement

    // No enforcement section → use defaults exactly
    if (!enforcementSection) {
        return {
            decisionPoints: { ...DEFAULT_RESOLVED_ENFORCEMENT.decisionPoints },
            points: { ...DEFAULT_RESOLVED_ENFORCEMENT.points },
        }
    }

    // ── Decision points ───────────────────────────────────────────────────────
    // decision_points is a list of active point names; the modes are always
    // the full non-off set (the config doesn't let you restrict modes per
    // decision point in the current schema — that would be enforcement.points).
    const decisionPoints: Record<string, RuleMode[]> = {
        ...DEFAULT_RESOLVED_ENFORCEMENT.decisionPoints,
    }

    if (Array.isArray(enforcementSection.decision_points)) {
        // Replace the default set with the configured set; add any new ones
        for (const dp of enforcementSection.decision_points) {
            if (typeof dp === 'string' && !decisionPoints[dp]) {
                decisionPoints[dp] = [...DEFAULT_ACTIVE_MODES]
            }
        }
    }

    // ── Enforcement points ────────────────────────────────────────────────────
    // Start from defaults so unconfigured standard points still work.
    const points: Record<string, EnforcementPointConfig> = {
        ...DEFAULT_ENFORCEMENT_POINTS,
    }

    if (enforcementSection.points && typeof enforcementSection.points === 'object') {
        for (const [pointName, rawPoint] of Object.entries(enforcementSection.points)) {
            if (rawPoint && typeof rawPoint === 'object') {
                // Custom points completely replace the default for that point name
                points[pointName] = parseEnforcementPoint(
                    rawPoint as Record<string, string | string[]>
                )
            }
        }
    }

    return { decisionPoints, points }
}

// ── PDP: getActiveModesForDecisionPoint ──────────────────────────────────────

/**
 * Returns the rule modes that should be evaluated at a given decision point.
 *
 * For known decision points: returns the configured modes.
 * For unknown decision points: returns DEFAULT_ACTIVE_MODES (all non-off).
 * This matches pre-UCFG behaviour where every violation was considered
 * regardless of where it was evaluated.
 */
export function getActiveModesForDecisionPoint(
    enforcement: ResolvedEnforcement,
    decisionPoint: string
): RuleMode[] {
    return enforcement.decisionPoints[decisionPoint] ?? [...DEFAULT_ACTIVE_MODES]
}

// ── PEP: getEnforcementAction ─────────────────────────────────────────────────

/**
 * Determines the enforcement action for a single violation.
 *
 * Precedence order: block > warn > auto_fix > pass
 *
 * For unknown enforcement points: returns 'warn' for any non-off mode.
 * This is safe — unknown points behave like mcp_audit (report but don't block).
 */
export function getEnforcementAction(
    enforcement: ResolvedEnforcement,
    enforcementPoint: string,
    violationMode: RuleMode
): 'block' | 'warn' | 'auto_fix' | 'pass' {
    // 'off' mode violations are never actionable — shouldn't be emitted
    if (violationMode === 'off') return 'pass'

    const pointConfig = enforcement.points[enforcementPoint]

    if (!pointConfig) {
        // Unknown enforcement point — report but don't block (safe default).
        // violationMode is already narrowed to non-'off' by the guard above.
        return 'warn'
    }

    // Precedence: block > auto_fix > warn > pass
    // Note: block takes priority over auto_fix because you can't auto-fix
    // a violation that is blocking (the block gate fires first).
    if (pointConfig.blockOn.includes(violationMode)) return 'block'
    if (pointConfig.autoFixOn.includes(violationMode)) return 'auto_fix'
    if (pointConfig.warnOn.includes(violationMode)) return 'warn'

    return 'pass'
}
