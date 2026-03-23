/**
 * Policy Engine — flint-mcp/src/core/policyEngine.ts
 *
 * Pure functions for resolving and evaluating Flint governance policy.
 * No side effects beyond reading a single local file (loadPolicy).
 * No SQLite, no IPC, no external calls.
 *
 * Group 1A of POL.1 — Configurable Policy Engine.
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PolicyMode = 'blocking' | 'advisory' | 'off'
export type SeverityFloor = 'critical' | 'warning' | 'info'
export type ConformanceLevel = 'A' | 'AA' | 'AAA'
export type GovernanceDomain =
    | 'general'
    | 'healthcare'
    | 'fintech'
    | 'e-commerce'
    | 'government'
    | 'enterprise-saas'

/** Per-rule mode overrides. Keys are rule IDs (e.g. 'MITHRIL-COL', 'A11Y-001'). */
export type RuleModeMap = Record<string, PolicyMode>

/** Mithril design-system linter section. */
export interface PolicyMithrilSection {
    deltaEThreshold: number
    deltaE_threshold: number              // alias used by MithrilLinter (snake_case compat)
    deltaE_critical_threshold: number
    mode: PolicyMode
    ignore_patterns: string[]
    /** Per-rule mode overrides. Rules not listed inherit `mode`. */
    rules: RuleModeMap
}

/** Accessibility linter section. */
export interface PolicyA11ySection {
    conformanceLevel: ConformanceLevel
    /** Same as conformanceLevel — kept for backward compat with existing `a11y.level` consumers. */
    level: ConformanceLevel
    mode: PolicyMode
    /** Per-rule mode overrides. Rules not listed inherit `mode`. */
    rules: RuleModeMap
    /**
     * @deprecated v1 field. Preserved for backward compat. Internally converted
     * to `rules[ruleId] = 'off'` entries. Do not use directly.
     */
    disabled_rules?: string[]
}

/** Export gate section. */
export interface PolicyExportGate {
    /**
     * Minimum severity that blocks export.
     *   'critical' — only critical violations block
     *   'warning'  — warning and critical block (default)
     *   'info'     — all violations block
     */
    severityFloor: SeverityFloor
    /** Canonical snake_case alias — kept for round-trip compat with policy.json. */
    severity_floor: SeverityFloor
    /** Whether component property overrides block export. */
    block_on_overrides: boolean
    /**
     * @deprecated v1 fields. Present for backward compat only.
     * When provided without severity_floor, converted:
     *   block_on_mithril=false → mithril.mode='advisory'
     *   block_on_a11y=false    → a11y.mode='advisory'
     */
    block_on_mithril?: boolean
    block_on_a11y?: boolean
}

/**
 * A team overlay — a deep-partial of each policy section that is merged
 * on top of the project-level policy when a teamId is active.
 */
export interface TeamOverlay {
    mithril?: Partial<PolicyMithrilSection>
    a11y?: Partial<PolicyA11ySection>
    exportGate?: Partial<PolicyExportGate>
    export_gate?: Partial<PolicyExportGate>
}

/**
 * Fully resolved policy (v2 shape). Every field is present with a concrete value.
 * This is what callers receive from resolvePolicy() — no optional fields to guard.
 */
export interface ResolvedPolicy {
    version: number
    domain: GovernanceDomain
    mithril: PolicyMithrilSection
    a11y: PolicyA11ySection
    exportGate: PolicyExportGate
    teams: Record<string, TeamOverlay>
}

// ── Internal raw policy shape (what lives in policy.json) ────────────────────

/**
 * Raw policy.json shape — accepts either v1 or v2 keys, all optional.
 * Used only internally for file I/O and migration.
 */
interface RawPolicy {
    version?: number
    domain?: string
    mithril?: {
        deltaE_threshold?: number
        deltaE_critical_threshold?: number
        mode?: string
        ignore_patterns?: string[]
        rules?: Record<string, string>
    }
    a11y?: {
        level?: string
        mode?: string
        disabled_rules?: string[]
        rules?: Record<string, string>
    }
    export_gate?: {
        severity_floor?: string
        block_on_overrides?: boolean
        block_on_mithril?: boolean
        block_on_a11y?: boolean
    }
    baseline?: {
        enabled?: boolean
    }
    teams?: Record<string, {
        mithril?: Partial<RawPolicy['mithril']>
        a11y?: Partial<RawPolicy['a11y']>
        export_gate?: Partial<RawPolicy['export_gate']>
    }>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_DOMAINS = new Set<string>([
    'general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas',
])

const VALID_POLICY_MODES = new Set<string>(['blocking', 'advisory', 'off'])

const VALID_CONFORMANCE_LEVELS = new Set<string>(['A', 'AA', 'AAA'])

const VALID_SEVERITY_FLOORS = new Set<string>(['critical', 'warning', 'info'])

// Known Mithril rule IDs (used for validation of per-rule maps).
const KNOWN_MITHRIL_RULES = new Set<string>([
    'MITHRIL-COL',
    'MITHRIL-TYP-001',
    'MITHRIL-TYP-002',
    'MITHRIL-TYP-003',
    'MITHRIL-TYP-004',
    'MITHRIL-TYP-005',
    'MITHRIL-SPC-001',
    'MITHRIL-SHD-001',
    'MITHRIL-OPC-001',
])

// Known A11y rule IDs.
const KNOWN_A11Y_RULES = new Set<string>([
    'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005',
    'A11Y-006', 'A11Y-007', 'A11Y-008', 'A11Y-009', 'A11Y-010',
])

// ── Default v2 policy ─────────────────────────────────────────────────────────

/** The default resolved policy — matches pre-POL.1 hardcoded behaviour exactly. */
export const DEFAULT_RESOLVED_POLICY: ResolvedPolicy = {
    version: 2,
    domain: 'general',
    mithril: {
        deltaEThreshold: 2.0,
        deltaE_threshold: 2.0,
        deltaE_critical_threshold: 10.0,
        mode: 'blocking',
        ignore_patterns: ['**/node_modules/**'],
        rules: {},
    },
    a11y: {
        conformanceLevel: 'AA',
        level: 'AA',
        mode: 'blocking',
        rules: {},
        disabled_rules: [],
    },
    exportGate: {
        severityFloor: 'warning',
        severity_floor: 'warning',
        block_on_overrides: true,
    },
    teams: {},
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * Migrates a v1 policy raw object to a v2-compatible raw object.
 *
 * V1 → V2 transformations:
 *   - `a11y.disabled_rules` array → entries in `a11y.rules` map with mode 'off'
 *   - `export_gate.block_on_mithril = false` → `mithril.mode = 'advisory'`
 *   - `export_gate.block_on_a11y = false`    → `a11y.mode = 'advisory'`
 *   - `version` bumped to 2
 *
 * The original fields are preserved for backward compat so downstream consumers
 * that still read the old keys do not break.
 */
export function migrateV1ToV2(policy: RawPolicy): RawPolicy {
    const migrated: RawPolicy = {
        ...policy,
        version: 2,
        mithril: { ...(policy.mithril ?? {}) },
        a11y: {
            ...(policy.a11y ?? {}),
            rules: { ...(policy.a11y?.rules ?? {}) },
        },
        export_gate: { ...(policy.export_gate ?? {}) },
    }

    // Convert disabled_rules → rules map entries with mode 'off'.
    const disabledRules = policy.a11y?.disabled_rules ?? []
    for (const ruleId of disabledRules) {
        migrated.a11y!.rules![ruleId] = 'off'
    }

    // Convert block_on_mithril=false → mithril.mode='advisory'
    if (policy.export_gate?.block_on_mithril === false) {
        // Only downgrade if not already explicitly set to something else.
        if (migrated.mithril!.mode === undefined || migrated.mithril!.mode === 'blocking') {
            migrated.mithril!.mode = 'advisory'
        }
    }

    // Convert block_on_a11y=false → a11y.mode='advisory'
    if (policy.export_gate?.block_on_a11y === false) {
        if (migrated.a11y!.mode === undefined || migrated.a11y!.mode === 'blocking') {
            migrated.a11y!.mode = 'advisory'
        }
    }

    return migrated
}

// ── Raw policy → ResolvedPolicy coercion ──────────────────────────────────────

/**
 * Coerces a raw (possibly partial) policy object into a complete ResolvedPolicy
 * by deep-merging with DEFAULT_RESOLVED_POLICY. No validation is performed here
 * (validation is done separately by validatePolicy).
 */
export function coerceToResolved(raw: RawPolicy): ResolvedPolicy {
    const def = DEFAULT_RESOLVED_POLICY

    // Determine mithril mode — run migration hints first.
    const rawMode = (raw.mithril?.mode as PolicyMode | undefined) ?? def.mithril.mode
    const deltaE = typeof raw.mithril?.deltaE_threshold === 'number'
        ? raw.mithril.deltaE_threshold
        : def.mithril.deltaEThreshold
    const deltaECritical = typeof raw.mithril?.deltaE_critical_threshold === 'number'
        ? raw.mithril.deltaE_critical_threshold
        : def.mithril.deltaE_critical_threshold

    // Mithril rules map — merge default (empty) with project rules.
    const mithrilRules: RuleModeMap = {}
    for (const [k, v] of Object.entries(raw.mithril?.rules ?? {})) {
        mithrilRules[k] = v as PolicyMode
    }

    // A11y section.
    const a11yLevel = (raw.a11y?.level as ConformanceLevel | undefined) ?? def.a11y.level
    const a11yMode = (raw.a11y?.mode as PolicyMode | undefined) ?? def.a11y.mode

    // Build a11y rules: merge disabled_rules-as-off first, then explicit rules map.
    const a11yRules: RuleModeMap = {}
    for (const ruleId of (raw.a11y?.disabled_rules ?? [])) {
        a11yRules[ruleId] = 'off'
    }
    for (const [k, v] of Object.entries(raw.a11y?.rules ?? {})) {
        a11yRules[k] = v as PolicyMode // explicit rules win over disabled_rules
    }

    // Export gate.
    const rawExportGate = raw.export_gate ?? {}
    let severityFloor: SeverityFloor = def.exportGate.severityFloor
    if (rawExportGate.severity_floor && VALID_SEVERITY_FLOORS.has(rawExportGate.severity_floor)) {
        severityFloor = rawExportGate.severity_floor as SeverityFloor
    }

    const domain = (VALID_DOMAINS.has(raw.domain ?? '')
        ? raw.domain as GovernanceDomain
        : def.domain)

    // Teams.
    const teams: Record<string, TeamOverlay> = {}
    for (const [teamId, overlay] of Object.entries(raw.teams ?? {})) {
        const mithrilOverlay: Partial<PolicyMithrilSection> = {}
        if (overlay.mithril) {
            if (typeof overlay.mithril.deltaE_threshold === 'number') {
                mithrilOverlay.deltaEThreshold = overlay.mithril.deltaE_threshold
                mithrilOverlay.deltaE_threshold = overlay.mithril.deltaE_threshold
            }
            if (overlay.mithril.mode && VALID_POLICY_MODES.has(overlay.mithril.mode)) {
                mithrilOverlay.mode = overlay.mithril.mode as PolicyMode
            }
            if (Array.isArray(overlay.mithril.ignore_patterns)) {
                mithrilOverlay.ignore_patterns = overlay.mithril.ignore_patterns as string[]
            }
            if (overlay.mithril.rules) {
                mithrilOverlay.rules = Object.fromEntries(
                    Object.entries(overlay.mithril.rules).map(([k, v]) => [k, v as PolicyMode])
                )
            }
        }
        const a11yOverlay: Partial<PolicyA11ySection> = {}
        if (overlay.a11y) {
            if (overlay.a11y.level && VALID_CONFORMANCE_LEVELS.has(overlay.a11y.level)) {
                a11yOverlay.conformanceLevel = overlay.a11y.level as ConformanceLevel
                a11yOverlay.level = overlay.a11y.level as ConformanceLevel
            }
            if (overlay.a11y.mode && VALID_POLICY_MODES.has(overlay.a11y.mode)) {
                a11yOverlay.mode = overlay.a11y.mode as PolicyMode
            }
            if (overlay.a11y.rules) {
                a11yOverlay.rules = Object.fromEntries(
                    Object.entries(overlay.a11y.rules).map(([k, v]) => [k, v as PolicyMode])
                )
            }
        }
        const exportGateOverlay: Partial<PolicyExportGate> = {}
        if (overlay.export_gate) {
            if (
                overlay.export_gate.severity_floor &&
                VALID_SEVERITY_FLOORS.has(overlay.export_gate.severity_floor)
            ) {
                exportGateOverlay.severityFloor = overlay.export_gate.severity_floor as SeverityFloor
                exportGateOverlay.severity_floor = overlay.export_gate.severity_floor as SeverityFloor
            }
            if (typeof overlay.export_gate.block_on_overrides === 'boolean') {
                exportGateOverlay.block_on_overrides = overlay.export_gate.block_on_overrides
            }
        }

        teams[teamId] = {
            mithril: Object.keys(mithrilOverlay).length ? mithrilOverlay : undefined,
            a11y: Object.keys(a11yOverlay).length ? a11yOverlay : undefined,
            exportGate: Object.keys(exportGateOverlay).length ? exportGateOverlay : undefined,
        }
    }

    return {
        version: 2,
        domain,
        mithril: {
            deltaEThreshold: deltaE,
            deltaE_threshold: deltaE,
            deltaE_critical_threshold: deltaECritical,
            mode: rawMode,
            ignore_patterns: Array.isArray(raw.mithril?.ignore_patterns)
                ? raw.mithril!.ignore_patterns as string[]
                : def.mithril.ignore_patterns,
            rules: mithrilRules,
        },
        a11y: {
            conformanceLevel: a11yLevel,
            level: a11yLevel,
            mode: a11yMode,
            rules: a11yRules,
            disabled_rules: raw.a11y?.disabled_rules ?? [],
        },
        exportGate: {
            severityFloor,
            severity_floor: severityFloor,
            block_on_overrides: typeof rawExportGate.block_on_overrides === 'boolean'
                ? rawExportGate.block_on_overrides
                : def.exportGate.block_on_overrides,
            block_on_mithril: rawExportGate.block_on_mithril,
            block_on_a11y: rawExportGate.block_on_a11y,
        },
        teams,
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Loads `.flint/policy.json` from the given project root.
 * Returns DEFAULT_RESOLVED_POLICY when the file is missing or malformed.
 * Transparently migrates v1 schema to v2 before returning.
 */
export function loadPolicy(projectRoot: string): ResolvedPolicy {
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')

    if (!fs.existsSync(policyPath)) {
        return structuredClone(DEFAULT_RESOLVED_POLICY)
    }

    try {
        const raw = JSON.parse(fs.readFileSync(policyPath, 'utf-8')) as RawPolicy

        // Reject unsupported future versions.
        if (raw.version !== undefined && raw.version !== 1 && raw.version !== 2) {
            console.error(
                `[policyEngine] Unsupported policy version ${raw.version}, using defaults`
            )
            return structuredClone(DEFAULT_RESOLVED_POLICY)
        }

        // Run v1 migration pass regardless — it is a no-op for v2 files.
        const migrated = (raw.version === 1 || raw.version === undefined)
            ? migrateV1ToV2(raw)
            : raw

        return coerceToResolved(migrated)
    } catch (err) {
        console.error(
            `[policyEngine] Failed to load ${policyPath}, using defaults:`,
            err instanceof Error ? err.message : err
        )
        return structuredClone(DEFAULT_RESOLVED_POLICY)
    }
}

/**
 * Resolves the effective policy for a given team.
 * Merge order: DEFAULT_RESOLVED_POLICY → project policy → team overlay.
 * When teamId is undefined or not found in teams, returns the project policy.
 */
export function resolvePolicy(projectRoot: string, teamId?: string): ResolvedPolicy {
    const projectPolicy = loadPolicy(projectRoot)

    if (!teamId) {
        return projectPolicy
    }

    const overlay = projectPolicy.teams[teamId]
    if (!overlay) {
        return projectPolicy
    }

    // Shallow-then-deep merge: overlay section values win over project.
    const resolved: ResolvedPolicy = structuredClone(projectPolicy)

    if (overlay.mithril) {
        resolved.mithril = { ...resolved.mithril, ...overlay.mithril }
        // Keep both aliases in sync.
        if (overlay.mithril.deltaEThreshold !== undefined) {
            resolved.mithril.deltaE_threshold = overlay.mithril.deltaEThreshold
        }
        if (overlay.mithril.deltaE_threshold !== undefined) {
            resolved.mithril.deltaEThreshold = overlay.mithril.deltaE_threshold
        }
    }

    if (overlay.a11y) {
        resolved.a11y = { ...resolved.a11y, ...overlay.a11y }
        if (overlay.a11y.conformanceLevel !== undefined) {
            resolved.a11y.level = overlay.a11y.conformanceLevel
        }
        if (overlay.a11y.level !== undefined) {
            resolved.a11y.conformanceLevel = overlay.a11y.level
        }
    }

    if (overlay.exportGate) {
        resolved.exportGate = { ...resolved.exportGate, ...overlay.exportGate }
        if (overlay.exportGate.severityFloor !== undefined) {
            resolved.exportGate.severity_floor = overlay.exportGate.severityFloor
        }
        if (overlay.exportGate.severity_floor !== undefined) {
            resolved.exportGate.severityFloor = overlay.exportGate.severity_floor
        }
    }

    // export_gate (snake_case alias in TeamOverlay) also applied.
    if (overlay.export_gate) {
        resolved.exportGate = { ...resolved.exportGate, ...overlay.export_gate }
        if (overlay.export_gate.severityFloor !== undefined) {
            resolved.exportGate.severity_floor = overlay.export_gate.severityFloor!
        }
        if (overlay.export_gate.severity_floor !== undefined) {
            resolved.exportGate.severityFloor = overlay.export_gate.severity_floor!
        }
    }

    return resolved
}

/**
 * Returns the effective mode for a specific rule ID.
 *
 * Resolution order:
 *   1. policy.mithril.rules[ruleId]  (if ruleId is a Mithril rule)
 *   2. policy.a11y.rules[ruleId]     (if ruleId is an A11y rule)
 *   3. policy.mithril.mode           (category-level fallback for Mithril rules)
 *   4. policy.a11y.mode              (category-level fallback for A11y rules)
 *   5. 'blocking'                    (global fallback for unknown rule IDs)
 */
export function getRuleMode(ruleId: string, policy: ResolvedPolicy): PolicyMode {
    // Check Mithril per-rule map first.
    if (ruleId in policy.mithril.rules) {
        return policy.mithril.rules[ruleId]
    }

    // Check A11y per-rule map.
    if (ruleId in policy.a11y.rules) {
        return policy.a11y.rules[ruleId]
    }

    // Fall back to category-level mode based on rule ID prefix.
    if (ruleId.startsWith('MITHRIL-')) {
        return policy.mithril.mode
    }
    if (ruleId.startsWith('A11Y-')) {
        return policy.a11y.mode
    }

    // Unknown rule — default to blocking (strictest safe default).
    return 'blocking'
}

/**
 * Returns the effective deltaE threshold from the resolved policy.
 * Guaranteed to be >= 0.5.
 */
export function getDeltaEThreshold(policy: ResolvedPolicy): number {
    return policy.mithril.deltaEThreshold
}

/**
 * Returns the effective critical deltaE threshold from the resolved policy.
 * Guaranteed to be > deltaEThreshold.
 */
export function getDeltaECriticalThreshold(policy: ResolvedPolicy): number {
    return policy.mithril.deltaE_critical_threshold
}

// ── Severity comparison ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
    info: 1,
    amber: 2,
    advisory: 2,  // 'advisory' is treated as equivalent to 'amber' for floor purposes
    warning: 2,
    critical: 3,
}

/**
 * Returns true when a violation's severity meets or exceeds the policy severity floor.
 */
function meetsFloor(
    severity: string,
    floor: SeverityFloor
): boolean {
    const rank = SEVERITY_RANK[severity] ?? 2
    const floorRank = SEVERITY_RANK[floor] ?? 2
    return rank >= floorRank
}

/**
 * Determines whether export should be blocked given a set of violations.
 *
 * A violation blocks export when ALL of these are true:
 *   1. getRuleMode(violation.ruleId, policy) === 'blocking'
 *   2. violation.severity meets or exceeds policy.exportGate.severityFloor
 *
 * Additionally, if overridesExist is true and policy.exportGate.block_on_overrides
 * is true, export is blocked regardless of violations.
 */
export function shouldBlockExport(
    violations: Array<{ ruleId: string; severity: 'info' | 'warning' | 'critical' | 'amber' }>,
    overridesExist: boolean,
    policy: ResolvedPolicy,
): boolean {
    // Check override gate first.
    if (overridesExist && policy.exportGate.block_on_overrides) {
        return true
    }

    const floor = policy.exportGate.severityFloor

    for (const violation of violations) {
        const mode = getRuleMode(violation.ruleId, policy)
        if (mode !== 'blocking') {
            continue
        }
        if (meetsFloor(violation.severity, floor)) {
            return true
        }
    }

    return false
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a raw JSON object against the FlintPolicy schema.
 *
 * Returns { valid: true, policy } on success or { valid: false, errors } on failure.
 * A missing file or empty object resolves to defaults (no errors).
 * Only structurally invalid or out-of-range values produce errors.
 */
export function validatePolicy(raw: unknown): { valid: true; policy: ResolvedPolicy } | { valid: false; errors: string[] } {
    if (raw === null || raw === undefined) {
        return { valid: false, errors: ['Policy must be a non-null object'] }
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { valid: false, errors: ['Policy must be a plain object'] }
    }

    const errors: string[] = []
    const p = raw as Record<string, unknown>

    // version
    if (p.version !== undefined) {
        if (typeof p.version !== 'number' || (p.version !== 1 && p.version !== 2)) {
            errors.push(`version must be 1 or 2, got ${JSON.stringify(p.version)}`)
        }
    }

    // domain
    if (p.domain !== undefined) {
        if (typeof p.domain !== 'string' || !VALID_DOMAINS.has(p.domain)) {
            errors.push(
                `domain must be one of ${[...VALID_DOMAINS].join(', ')}, got ${JSON.stringify(p.domain)}`
            )
        }
    }

    // mithril section
    if (p.mithril !== undefined) {
        if (typeof p.mithril !== 'object' || Array.isArray(p.mithril) || p.mithril === null) {
            errors.push('mithril must be an object')
        } else {
            const m = p.mithril as Record<string, unknown>

            if (m.deltaE_threshold !== undefined) {
                if (typeof m.deltaE_threshold !== 'number') {
                    errors.push('mithril.deltaE_threshold must be a number')
                } else if (m.deltaE_threshold < 0.5 || m.deltaE_threshold > 20.0) {
                    errors.push(
                        `mithril.deltaE_threshold must be between 0.5 and 20.0, got ${m.deltaE_threshold}`
                    )
                }
            }

            if (m.deltaE_critical_threshold !== undefined) {
                const dE = typeof m.deltaE_threshold === 'number' ? m.deltaE_threshold : 2.0
                if (typeof m.deltaE_critical_threshold !== 'number') {
                    errors.push('mithril.deltaE_critical_threshold must be a number')
                } else if (m.deltaE_critical_threshold <= dE) {
                    errors.push(
                        `mithril.deltaE_critical_threshold (${m.deltaE_critical_threshold}) must be greater than deltaE_threshold (${dE})`
                    )
                }
            }

            if (m.mode !== undefined && !VALID_POLICY_MODES.has(m.mode as string)) {
                errors.push(
                    `mithril.mode must be one of blocking|advisory|off, got ${JSON.stringify(m.mode)}`
                )
            }

            if (m.rules !== undefined) {
                if (typeof m.rules !== 'object' || Array.isArray(m.rules) || m.rules === null) {
                    errors.push('mithril.rules must be an object')
                } else {
                    for (const [ruleId, mode] of Object.entries(m.rules as Record<string, unknown>)) {
                        if (!KNOWN_MITHRIL_RULES.has(ruleId)) {
                            errors.push(`mithril.rules contains unknown rule ID: ${ruleId}`)
                        }
                        if (!VALID_POLICY_MODES.has(mode as string)) {
                            errors.push(
                                `mithril.rules[${ruleId}] must be blocking|advisory|off, got ${JSON.stringify(mode)}`
                            )
                        }
                    }
                }
            }
        }
    }

    // a11y section
    if (p.a11y !== undefined) {
        if (typeof p.a11y !== 'object' || Array.isArray(p.a11y) || p.a11y === null) {
            errors.push('a11y must be an object')
        } else {
            const a = p.a11y as Record<string, unknown>

            if (a.level !== undefined && !VALID_CONFORMANCE_LEVELS.has(a.level as string)) {
                errors.push(
                    `a11y.level must be A|AA|AAA, got ${JSON.stringify(a.level)}`
                )
            }

            if (a.mode !== undefined && !VALID_POLICY_MODES.has(a.mode as string)) {
                errors.push(
                    `a11y.mode must be blocking|advisory|off, got ${JSON.stringify(a.mode)}`
                )
            }

            if (a.rules !== undefined) {
                if (typeof a.rules !== 'object' || Array.isArray(a.rules) || a.rules === null) {
                    errors.push('a11y.rules must be an object')
                } else {
                    for (const [ruleId, mode] of Object.entries(a.rules as Record<string, unknown>)) {
                        if (!KNOWN_A11Y_RULES.has(ruleId)) {
                            errors.push(`a11y.rules contains unknown rule ID: ${ruleId}`)
                        }
                        if (!VALID_POLICY_MODES.has(mode as string)) {
                            errors.push(
                                `a11y.rules[${ruleId}] must be blocking|advisory|off, got ${JSON.stringify(mode)}`
                            )
                        }
                    }
                }
            }
        }
    }

    // export_gate section
    if (p.export_gate !== undefined) {
        if (
            typeof p.export_gate !== 'object' ||
            Array.isArray(p.export_gate) ||
            p.export_gate === null
        ) {
            errors.push('export_gate must be an object')
        } else {
            const e = p.export_gate as Record<string, unknown>

            if (e.severity_floor !== undefined && !VALID_SEVERITY_FLOORS.has(e.severity_floor as string)) {
                errors.push(
                    `export_gate.severity_floor must be critical|warning|info, got ${JSON.stringify(e.severity_floor)}`
                )
            }

            if (e.block_on_overrides !== undefined && typeof e.block_on_overrides !== 'boolean') {
                errors.push('export_gate.block_on_overrides must be a boolean')
            }
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors }
    }

    // Build and return the resolved policy from valid raw input.
    const migrated = migrateV1ToV2(p as RawPolicy)
    const policy = coerceToResolved(migrated)
    return { valid: true, policy }
}
