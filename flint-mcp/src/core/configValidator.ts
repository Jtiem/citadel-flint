/**
 * Config Validator — flint-mcp/src/core/configValidator.ts
 *
 * Validates a FlintProjectConfig parsed from YAML at parse time.
 * Returns actionable error messages instead of silently accepting bad data.
 *
 * Design principles:
 *   - Never throws — always returns ValidationError[]
 *   - Collects ALL errors in one pass (not fail-fast)
 *   - Paths use dot notation matching YAML key paths
 *   - Validation does not block loading (warnings, not hard errors)
 */

import type {
    GovernanceDomain,
    DataClassification,
    RuleMode,
    TrustTier,
    LegacyTrustTier,
    A11yLevel,
} from './config.js'

// ── Error type ────────────────────────────────────────────────────────────────

export interface ValidationError {
    /** Dot-notation path to the invalid field, e.g. "rules.mithril.delta_e" */
    path: string
    /** Human-readable error message, e.g. "must be a number, got 'banana'" */
    message: string
    /** The invalid value that triggered this error */
    value?: unknown
}

// ── Valid value sets ──────────────────────────────────────────────────────────

const VALID_DOMAINS: GovernanceDomain[] = [
    'general',
    'healthcare',
    'fintech',
    'e-commerce',
    'government',
    'enterprise-saas',
]

const VALID_CLASSIFICATIONS: DataClassification[] = [
    'public',
    'internal',
    'confidential',
    'restricted',
]

const VALID_RULE_MODES: RuleMode[] = ['coercive', 'normative', 'advisory', 'off']

const VALID_A11Y_LEVELS: A11yLevel[] = ['A', 'AA', 'AAA']

const VALID_TRUST_TIERS: TrustTier[] = ['intern', 'junior', 'senior', 'principal']

const VALID_LEGACY_TIERS: LegacyTrustTier[] = ['untrusted', 'standard', 'elevated', 'admin']

// ── Validation helpers ────────────────────────────────────────────────────────

function isValidTrustTier(v: unknown): boolean {
    return (
        (VALID_TRUST_TIERS as unknown[]).includes(v) ||
        (VALID_LEGACY_TIERS as unknown[]).includes(v)
    )
}

function typeName(v: unknown): string {
    if (v === null) return 'null'
    if (Array.isArray(v)) return 'array'
    return typeof v
}

// ── Main validator ────────────────────────────────────────────────────────────

/**
 * Validates a FlintProjectConfig parsed from YAML.
 * Returns an empty array if valid, or an array of actionable ValidationErrors.
 *
 * All fields except `project` are optional — only present values are validated.
 */
export function validateProjectConfig(config: unknown): ValidationError[] {
    const errors: ValidationError[] = []

    // Guard: config must be an object
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        errors.push({
            path: '(root)',
            message: `config must be an object, got ${typeName(config)}`,
            value: config,
        })
        return errors
    }

    const c = config as Record<string, unknown>

    // ── project (required, non-empty string) ─────────────────────────────────
    if (!('project' in c) || c.project === undefined || c.project === null) {
        errors.push({
            path: 'project',
            message: 'required field is missing',
            value: undefined,
        })
    } else if (typeof c.project !== 'string') {
        errors.push({
            path: 'project',
            message: `must be a string, got ${typeName(c.project)}`,
            value: c.project,
        })
    } else if ((c.project as string).trim() === '') {
        errors.push({
            path: 'project',
            message: 'must be a non-empty string',
            value: c.project,
        })
    }

    // ── schema_version (string if present) ───────────────────────────────────
    if ('schema_version' in c && c.schema_version !== undefined) {
        if (typeof c.schema_version !== 'string') {
            errors.push({
                path: 'schema_version',
                message: `must be a string, got ${typeName(c.schema_version)}`,
                value: c.schema_version,
            })
        }
    }

    // ── domain (valid GovernanceDomain if present) ────────────────────────────
    if ('domain' in c && c.domain !== undefined) {
        if (!(VALID_DOMAINS as unknown[]).includes(c.domain)) {
            errors.push({
                path: 'domain',
                message: `must be one of [${VALID_DOMAINS.join(', ')}], got '${c.domain}'`,
                value: c.domain,
            })
        }
    }

    // ── classification (valid DataClassification if present) ─────────────────
    if ('classification' in c && c.classification !== undefined) {
        if (!(VALID_CLASSIFICATIONS as unknown[]).includes(c.classification)) {
            errors.push({
                path: 'classification',
                message: `must be one of [${VALID_CLASSIFICATIONS.join(', ')}], got '${c.classification}'`,
                value: c.classification,
            })
        }
    }

    // ── rules section ─────────────────────────────────────────────────────────
    if ('rules' in c && c.rules !== undefined) {
        if (typeof c.rules !== 'object' || Array.isArray(c.rules) || c.rules === null) {
            errors.push({
                path: 'rules',
                message: `must be an object, got ${typeName(c.rules)}`,
                value: c.rules,
            })
        } else {
            const rules = c.rules as Record<string, unknown>

            // rules.mithril
            if ('mithril' in rules && rules.mithril !== undefined) {
                if (
                    typeof rules.mithril !== 'object' ||
                    Array.isArray(rules.mithril) ||
                    rules.mithril === null
                ) {
                    errors.push({
                        path: 'rules.mithril',
                        message: `must be an object, got ${typeName(rules.mithril)}`,
                        value: rules.mithril,
                    })
                } else {
                    const mithril = rules.mithril as Record<string, unknown>

                    // rules.mithril.mode
                    if ('mode' in mithril && mithril.mode !== undefined) {
                        if (!(VALID_RULE_MODES as unknown[]).includes(mithril.mode)) {
                            errors.push({
                                path: 'rules.mithril.mode',
                                message: `must be one of [${VALID_RULE_MODES.join(', ')}], got '${mithril.mode}'`,
                                value: mithril.mode,
                            })
                        }
                    }

                    // rules.mithril.delta_e
                    if ('delta_e' in mithril && mithril.delta_e !== undefined) {
                        if (typeof mithril.delta_e !== 'number') {
                            errors.push({
                                path: 'rules.mithril.delta_e',
                                message: `must be a number, got ${typeName(mithril.delta_e)} ('${mithril.delta_e}')`,
                                value: mithril.delta_e,
                            })
                        } else if ((mithril.delta_e as number) <= 0) {
                            errors.push({
                                path: 'rules.mithril.delta_e',
                                message: `must be a positive number, got ${mithril.delta_e}`,
                                value: mithril.delta_e,
                            })
                        }
                    }

                    // rules.mithril.delta_e_critical
                    if ('delta_e_critical' in mithril && mithril.delta_e_critical !== undefined) {
                        if (typeof mithril.delta_e_critical !== 'number') {
                            errors.push({
                                path: 'rules.mithril.delta_e_critical',
                                message: `must be a number, got ${typeName(mithril.delta_e_critical)} ('${mithril.delta_e_critical}')`,
                                value: mithril.delta_e_critical,
                            })
                        } else if ((mithril.delta_e_critical as number) <= 0) {
                            errors.push({
                                path: 'rules.mithril.delta_e_critical',
                                message: `must be a positive number, got ${mithril.delta_e_critical}`,
                                value: mithril.delta_e_critical,
                            })
                        }
                    }

                    // delta_e_critical must be > delta_e when both are valid numbers
                    if (
                        typeof mithril.delta_e === 'number' &&
                        mithril.delta_e > 0 &&
                        typeof mithril.delta_e_critical === 'number' &&
                        mithril.delta_e_critical > 0 &&
                        (mithril.delta_e_critical as number) <= (mithril.delta_e as number)
                    ) {
                        errors.push({
                            path: 'rules.mithril.delta_e_critical',
                            message: `must be greater than rules.mithril.delta_e (${mithril.delta_e}), got ${mithril.delta_e_critical}`,
                            value: mithril.delta_e_critical,
                        })
                    }
                }
            }

            // rules.export_gate (MAJOR-1 fix, Sprint 3)
            if ('export_gate' in rules && rules.export_gate !== undefined) {
                if (
                    typeof rules.export_gate !== 'object' ||
                    Array.isArray(rules.export_gate) ||
                    rules.export_gate === null
                ) {
                    errors.push({
                        path: 'rules.export_gate',
                        message: `must be an object, got ${typeName(rules.export_gate)}`,
                        value: rules.export_gate,
                    })
                } else {
                    const gate = rules.export_gate as Record<string, unknown>
                    for (const key of ['block_on_overrides', 'block_on_mithril', 'block_on_a11y']) {
                        if (key in gate && gate[key] !== undefined && typeof gate[key] !== 'boolean') {
                            errors.push({
                                path: `rules.export_gate.${key}`,
                                message: `must be a boolean, got ${typeName(gate[key])}`,
                                value: gate[key],
                            })
                        }
                    }
                }
            }

            // rules.baseline (MAJOR-1 fix, Sprint 3)
            if ('baseline' in rules && rules.baseline !== undefined) {
                if (
                    typeof rules.baseline !== 'object' ||
                    Array.isArray(rules.baseline) ||
                    rules.baseline === null
                ) {
                    errors.push({
                        path: 'rules.baseline',
                        message: `must be an object, got ${typeName(rules.baseline)}`,
                        value: rules.baseline,
                    })
                } else {
                    const baseline = rules.baseline as Record<string, unknown>
                    if ('enabled' in baseline && baseline.enabled !== undefined && typeof baseline.enabled !== 'boolean') {
                        errors.push({
                            path: 'rules.baseline.enabled',
                            message: `must be a boolean, got ${typeName(baseline.enabled)}`,
                            value: baseline.enabled,
                        })
                    }
                }
            }

            // rules.accessibility
            if ('accessibility' in rules && rules.accessibility !== undefined) {
                if (
                    typeof rules.accessibility !== 'object' ||
                    Array.isArray(rules.accessibility) ||
                    rules.accessibility === null
                ) {
                    errors.push({
                        path: 'rules.accessibility',
                        message: `must be an object, got ${typeName(rules.accessibility)}`,
                        value: rules.accessibility,
                    })
                } else {
                    const a11y = rules.accessibility as Record<string, unknown>

                    // rules.accessibility.level
                    if ('level' in a11y && a11y.level !== undefined) {
                        if (!(VALID_A11Y_LEVELS as unknown[]).includes(a11y.level)) {
                            errors.push({
                                path: 'rules.accessibility.level',
                                message: `must be one of [${VALID_A11Y_LEVELS.join(', ')}], got '${a11y.level}'`,
                                value: a11y.level,
                            })
                        }
                    }

                    // rules.accessibility.mode
                    if ('mode' in a11y && a11y.mode !== undefined) {
                        if (!(VALID_RULE_MODES as unknown[]).includes(a11y.mode)) {
                            errors.push({
                                path: 'rules.accessibility.mode',
                                message: `must be one of [${VALID_RULE_MODES.join(', ')}], got '${a11y.mode}'`,
                                value: a11y.mode,
                            })
                        }
                    }
                }
            }
        }
    }

    // ── trust section ─────────────────────────────────────────────────────────
    if ('trust' in c && c.trust !== undefined) {
        if (typeof c.trust !== 'object' || Array.isArray(c.trust) || c.trust === null) {
            errors.push({
                path: 'trust',
                message: `must be an object, got ${typeName(c.trust)}`,
                value: c.trust,
            })
        } else {
            const trust = c.trust as Record<string, unknown>

            // trust.default_tier
            if ('default_tier' in trust && trust.default_tier !== undefined) {
                if (!isValidTrustTier(trust.default_tier)) {
                    errors.push({
                        path: 'trust.default_tier',
                        message: `must be one of [${[...VALID_TRUST_TIERS, ...VALID_LEGACY_TIERS].join(', ')}], got '${trust.default_tier}'`,
                        value: trust.default_tier,
                    })
                }
            }

            // trust.profiles — MAJOR-1 (Sprint 3): validate each entry
            if ('profiles' in trust && trust.profiles !== undefined) {
                if (!Array.isArray(trust.profiles)) {
                    errors.push({
                        path: 'trust.profiles',
                        message: `must be an array, got ${typeName(trust.profiles)}`,
                        value: trust.profiles,
                    })
                } else {
                    const profiles = trust.profiles as unknown[]
                    profiles.forEach((entry, i) => {
                        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                            errors.push({
                                path: `trust.profiles[${i}]`,
                                message: `must be an object, got ${typeName(entry)}`,
                                value: entry,
                            })
                            return
                        }
                        const p = entry as Record<string, unknown>
                        if (typeof p.id !== 'string' || (p.id as string).trim() === '') {
                            errors.push({
                                path: `trust.profiles[${i}].id`,
                                message: `must be a non-empty string, got ${typeName(p.id)}`,
                                value: p.id,
                            })
                        }
                        if ('tier' in p && p.tier !== undefined && !isValidTrustTier(p.tier)) {
                            errors.push({
                                path: `trust.profiles[${i}].tier`,
                                message: `must be one of [${[...VALID_TRUST_TIERS, ...VALID_LEGACY_TIERS].join(', ')}], got '${p.tier}'`,
                                value: p.tier,
                            })
                        }
                    })
                }
            }

            // trust.approval — array of gate objects if present
            if ('approval' in trust && trust.approval !== undefined) {
                if (!Array.isArray(trust.approval)) {
                    errors.push({
                        path: 'trust.approval',
                        message: `must be an array, got ${typeName(trust.approval)}`,
                        value: trust.approval,
                    })
                }
            }

            // trust.escalation — array of rule objects if present
            if ('escalation' in trust && trust.escalation !== undefined) {
                if (!Array.isArray(trust.escalation)) {
                    errors.push({
                        path: 'trust.escalation',
                        message: `must be an array, got ${typeName(trust.escalation)}`,
                        value: trust.escalation,
                    })
                }
            }
        }
    }

    // ── enforcement section (MAJOR-1, Sprint 3) ───────────────────────────────
    if ('enforcement' in c && c.enforcement !== undefined) {
        if (typeof c.enforcement !== 'object' || Array.isArray(c.enforcement) || c.enforcement === null) {
            errors.push({
                path: 'enforcement',
                message: `must be an object, got ${typeName(c.enforcement)}`,
                value: c.enforcement,
            })
        } else {
            const enf = c.enforcement as Record<string, unknown>
            if ('decision_points' in enf && enf.decision_points !== undefined) {
                if (!Array.isArray(enf.decision_points)) {
                    errors.push({
                        path: 'enforcement.decision_points',
                        message: `must be an array of strings, got ${typeName(enf.decision_points)}`,
                        value: enf.decision_points,
                    })
                } else {
                    (enf.decision_points as unknown[]).forEach((entry, i) => {
                        if (typeof entry !== 'string') {
                            errors.push({
                                path: `enforcement.decision_points[${i}]`,
                                message: `must be a string, got ${typeName(entry)}`,
                                value: entry,
                            })
                        }
                    })
                }
            }
            if ('mode' in enf && enf.mode !== undefined && !(VALID_RULE_MODES as unknown[]).includes(enf.mode)) {
                errors.push({
                    path: 'enforcement.mode',
                    message: `must be one of [${VALID_RULE_MODES.join(', ')}], got '${enf.mode}'`,
                    value: enf.mode,
                })
            }
        }
    }

    // ── environments section (MAJOR-1, Sprint 3) — recursive validation ───────
    if ('environments' in c && c.environments !== undefined) {
        if (
            typeof c.environments !== 'object' ||
            Array.isArray(c.environments) ||
            c.environments === null
        ) {
            errors.push({
                path: 'environments',
                message: `must be an object, got ${typeName(c.environments)}`,
                value: c.environments,
            })
        } else {
            const envs = c.environments as Record<string, unknown>
            for (const [envName, envConfig] of Object.entries(envs)) {
                if (!envConfig || typeof envConfig !== 'object' || Array.isArray(envConfig)) {
                    errors.push({
                        path: `environments.${envName}`,
                        message: `must be an object, got ${typeName(envConfig)}`,
                        value: envConfig,
                    })
                    continue
                }
                // Recursively validate the overlay as a partial config.
                // Overlays do not require `project`, so inject a placeholder
                // before recursing so the "required project" check does not
                // produce false-positive errors for environment overlays.
                const overlayWithProject = {
                    project: '__env_overlay__',
                    ...(envConfig as Record<string, unknown>),
                }
                const nestedErrors = validateProjectConfig(overlayWithProject)
                for (const ne of nestedErrors) {
                    // Skip the placeholder project error (it's ours, not the user's).
                    if (ne.path === 'project') continue
                    errors.push({
                        path: `environments.${envName}.${ne.path}`,
                        message: ne.message,
                        value: ne.value,
                    })
                }
            }
        }
    }

    // ── scoring section ───────────────────────────────────────────────────────
    if ('scoring' in c && c.scoring !== undefined) {
        if (typeof c.scoring !== 'object' || Array.isArray(c.scoring) || c.scoring === null) {
            errors.push({
                path: 'scoring',
                message: `must be an object, got ${typeName(c.scoring)}`,
                value: c.scoring,
            })
        } else {
            const scoring = c.scoring as Record<string, unknown>

            if ('weights' in scoring && scoring.weights !== undefined) {
                if (
                    typeof scoring.weights !== 'object' ||
                    Array.isArray(scoring.weights) ||
                    scoring.weights === null
                ) {
                    errors.push({
                        path: 'scoring.weights',
                        message: `must be an object, got ${typeName(scoring.weights)}`,
                        value: scoring.weights,
                    })
                } else {
                    const weights = scoring.weights as Record<string, unknown>
                    const weightKeys = ['coercive', 'normative', 'advisory', 'recency']

                    for (const key of weightKeys) {
                        if (key in weights && weights[key] !== undefined) {
                            const w = weights[key]
                            if (typeof w !== 'number') {
                                errors.push({
                                    path: `scoring.weights.${key}`,
                                    message: `must be a number, got ${typeName(w)}`,
                                    value: w,
                                })
                            } else if ((w as number) < 0 || (w as number) > 1) {
                                errors.push({
                                    path: `scoring.weights.${key}`,
                                    message: `must be between 0 and 1, got ${w}`,
                                    value: w,
                                })
                            }
                        }
                    }
                }
            }
        }
    }

    // ── extends (array of strings if present) ─────────────────────────────────
    if ('extends' in c && c.extends !== undefined) {
        if (!Array.isArray(c.extends)) {
            errors.push({
                path: 'extends',
                message: `must be an array of strings, got ${typeName(c.extends)}`,
                value: c.extends,
            })
        } else {
            const exts = c.extends as unknown[]
            for (let i = 0; i < exts.length; i++) {
                if (typeof exts[i] !== 'string') {
                    errors.push({
                        path: `extends[${i}]`,
                        message: `must be a string, got ${typeName(exts[i])}`,
                        value: exts[i],
                    })
                }
            }
        }
    }

    // ── tighten_only (boolean if present) ─────────────────────────────────────
    if ('tighten_only' in c && c.tighten_only !== undefined) {
        if (typeof c.tighten_only !== 'boolean') {
            errors.push({
                path: 'tighten_only',
                message: `must be a boolean, got ${typeName(c.tighten_only)}`,
                value: c.tighten_only,
            })
        }
    }

    return errors
}
