/**
 * electron/agentEscalation.ts — AGV.3: Auto-Escalation Rules
 *
 * Configurable rules that trigger when an agent's cumulative risk behavior
 * exceeds thresholds. When an escalation fires, it can force manual review,
 * downgrade the agent's trust tier, block all mutations, or emit an alert.
 *
 * Architecture:
 *   - In-memory tracking only (session-scoped, no SQLite).
 *   - Default rules are sensible and active out of the box.
 *   - Custom rules loaded from `.flint/escalation-rules.json` merge with defaults.
 *   - Escalation engine is testable without mocking the full orchestrator.
 *
 * Integration points:
 *   - orchestrator.ts calls recordMutationRisk() after MRS computation.
 *   - orchestrator.ts calls checkEscalation() and applies the result.
 *   - agentPolicy.ts exposes isEscalated() for external queries.
 *
 * Territory: electron/ only — does NOT touch flint-mcp/src/.
 */

import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const _require = createRequire(import.meta.url)
const _dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolves the `yaml` package from root node_modules or flint-mcp's bundled copy.
 * Returns null if unavailable in both locations.
 */
function _resolveYaml(): { parse: (src: string) => unknown } | null {
    try {
        return _require('yaml') as { parse: (src: string) => unknown }
    } catch {
        // Not in root — try flint-mcp bundled copy
    }
    try {
        const flintMcpYaml = path.resolve(_dirname, '..', 'flint-mcp', 'node_modules', 'yaml', 'dist', 'index.js')
        return _require(flintMcpYaml) as { parse: (src: string) => unknown }
    } catch {
        return null
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MRSTierInput = 'green' | 'amber' | 'red'

export type EscalationTriggerType =
    | 'red_count'
    | 'amber_count'
    | 'session_risk_avg'
    | 'mutation_velocity'

export type EscalationTimeWindow = 'session' | 'hour' | 'day'

export interface EscalationTrigger {
    type: EscalationTriggerType
    threshold: number
    window: EscalationTimeWindow
}

export type EscalationAction =
    | { type: 'require_review' }
    | { type: 'downgrade_tier'; to: string }
    | { type: 'block_mutations' }
    | { type: 'alert'; message: string }

export interface EscalationRule {
    ruleId: string
    description: string
    trigger: EscalationTrigger
    action: EscalationAction
}

export interface EscalationResult {
    ruleId: string
    description: string
    action: EscalationAction
    reason: string
}

/** A single recorded mutation risk data point. */
export interface RiskDataPoint {
    timestamp: number
    tier: MRSTierInput
    score: number
}

/** Shape of the optional `.flint/escalation-rules.json` file. */
export interface EscalationRulesFile {
    version?: number
    rules?: EscalationRule[]
}

// ── Default Rules ─────────────────────────────────────────────────────────────

const DEFAULT_RULES: readonly EscalationRule[] = Object.freeze([
    {
        ruleId: 'RULE-001',
        description: '3+ Red-tier mutations in a session triggers require_review for all subsequent mutations',
        trigger: { type: 'red_count', threshold: 3, window: 'session' },
        action: { type: 'require_review' },
    },
    {
        ruleId: 'RULE-002',
        description: '5+ Amber-tier mutations in an hour triggers an alert',
        trigger: { type: 'amber_count', threshold: 5, window: 'hour' },
        action: { type: 'alert', message: 'Agent producing elevated risk — 5+ Amber-tier mutations in the last hour' },
    },
    {
        ruleId: 'RULE-003',
        description: 'Session average risk > 0.6 triggers downgrade to standard tier',
        trigger: { type: 'session_risk_avg', threshold: 0.6, window: 'session' },
        action: { type: 'downgrade_tier', to: 'standard' },
    },
    {
        ruleId: 'RULE-004',
        description: '20+ mutations in 5 minutes triggers block_mutations (hallucination loop detection)',
        trigger: { type: 'mutation_velocity', threshold: 20, window: 'session' },
        action: { type: 'block_mutations' },
    },
])

// ── Time Windows ──────────────────────────────────────────────────────────────

/** Returns the cutoff timestamp in ms for a given window. */
function getWindowCutoff(window: EscalationTimeWindow): number {
    const now = Date.now()
    switch (window) {
        case 'session':
            return 0 // all session data
        case 'hour':
            return now - 60 * 60 * 1000
        case 'day':
            return now - 24 * 60 * 60 * 1000
        default:
            return 0
    }
}

// ── Escalation Engine ─────────────────────────────────────────────────────────

export class EscalationEngine {
    /** Per-agent risk history. Key: agentId, Value: array of data points. */
    private agentRiskHistory = new Map<string, RiskDataPoint[]>()

    /** Per-agent active escalations. Key: agentId, Value: array of results. */
    private activeEscalations = new Map<string, EscalationResult[]>()

    /** The rule set — defaults merged with custom rules. */
    private rules: EscalationRule[]

    constructor(customRules?: EscalationRule[]) {
        this.rules = mergeRules(customRules)
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Records a mutation risk data point for the given agent.
     * Called by orchestrator.ts after MRS computation.
     */
    recordMutationRisk(agentId: string, riskTier: MRSTierInput, riskScore: number): void {
        const dataPoint: RiskDataPoint = {
            timestamp: Date.now(),
            tier: riskTier,
            score: riskScore,
        }

        const history = this.agentRiskHistory.get(agentId)
        if (history) {
            history.push(dataPoint)
        } else {
            this.agentRiskHistory.set(agentId, [dataPoint])
        }
    }

    /**
     * Evaluates all rules against the agent's risk history.
     * Returns an array of escalation results that fired, or an empty array.
     */
    checkEscalation(agentId: string): EscalationResult[] {
        const history = this.agentRiskHistory.get(agentId)
        if (!history || history.length === 0) return []

        const fired: EscalationResult[] = []

        for (const rule of this.rules) {
            const result = this.evaluateRule(rule, agentId, history)
            if (result) {
                // Check if this escalation is already active for this agent
                const existing = this.activeEscalations.get(agentId)
                const alreadyActive = existing?.some(e => e.ruleId === rule.ruleId) ?? false

                if (!alreadyActive) {
                    fired.push(result)
                    console.warn(`[Flint AGV] Escalation fired: ${rule.ruleId} for agent "${agentId}" — ${result.reason}`)

                    // Record as active
                    if (existing) {
                        existing.push(result)
                    } else {
                        this.activeEscalations.set(agentId, [result])
                    }
                }
            }
        }

        return fired
    }

    /**
     * Returns the risk history for a given agent.
     */
    getAgentRiskHistory(agentId: string): RiskDataPoint[] {
        return this.agentRiskHistory.get(agentId) ?? []
    }

    /**
     * Returns all currently active escalations for a given agent.
     */
    getActiveEscalations(agentId: string): EscalationResult[] {
        return this.activeEscalations.get(agentId) ?? []
    }

    /**
     * Returns true if the agent has any active escalation.
     */
    isEscalated(agentId: string): boolean {
        const escalations = this.activeEscalations.get(agentId)
        return escalations !== undefined && escalations.length > 0
    }

    /**
     * Returns true if the agent has a specific escalation action type active.
     */
    hasActiveAction(agentId: string, actionType: EscalationAction['type']): boolean {
        const escalations = this.activeEscalations.get(agentId)
        if (!escalations) return false
        return escalations.some(e => e.action.type === actionType)
    }

    /**
     * Clears all session data for a given agent.
     * Called on new file open or explicit reset.
     */
    resetSession(agentId: string): void {
        this.agentRiskHistory.delete(agentId)
        this.activeEscalations.delete(agentId)
    }

    /**
     * Clears all data for all agents.
     */
    resetAll(): void {
        this.agentRiskHistory.clear()
        this.activeEscalations.clear()
    }

    /**
     * Replaces the active rule set. Used when loading custom rules from disk.
     */
    setRules(customRules?: EscalationRule[]): void {
        this.rules = mergeRules(customRules)
    }

    /**
     * Returns the current rule set.
     */
    getRules(): EscalationRule[] {
        return [...this.rules]
    }

    // ── Rule Evaluation ───────────────────────────────────────────────────────

    private evaluateRule(
        rule: EscalationRule,
        agentId: string,
        history: RiskDataPoint[],
    ): EscalationResult | null {
        const cutoff = getWindowCutoff(rule.trigger.window)
        const windowedHistory = history.filter(dp => dp.timestamp >= cutoff)

        if (windowedHistory.length === 0) return null

        switch (rule.trigger.type) {
            case 'red_count': {
                const redCount = windowedHistory.filter(dp => dp.tier === 'red').length
                if (redCount >= rule.trigger.threshold) {
                    return {
                        ruleId: rule.ruleId,
                        description: rule.description,
                        action: rule.action,
                        reason: `Agent "${agentId}" produced ${redCount} Red-tier mutations (threshold: ${rule.trigger.threshold}, window: ${rule.trigger.window})`,
                    }
                }
                return null
            }

            case 'amber_count': {
                const amberCount = windowedHistory.filter(dp => dp.tier === 'amber').length
                if (amberCount >= rule.trigger.threshold) {
                    return {
                        ruleId: rule.ruleId,
                        description: rule.description,
                        action: rule.action,
                        reason: `Agent "${agentId}" produced ${amberCount} Amber-tier mutations (threshold: ${rule.trigger.threshold}, window: ${rule.trigger.window})`,
                    }
                }
                return null
            }

            case 'session_risk_avg': {
                const totalScore = windowedHistory.reduce((sum, dp) => sum + dp.score, 0)
                const avgScore = totalScore / windowedHistory.length
                if (avgScore > rule.trigger.threshold) {
                    return {
                        ruleId: rule.ruleId,
                        description: rule.description,
                        action: rule.action,
                        reason: `Agent "${agentId}" session average risk is ${avgScore.toFixed(3)} (threshold: ${rule.trigger.threshold}, window: ${rule.trigger.window})`,
                    }
                }
                return null
            }

            case 'mutation_velocity': {
                // RULE-004 uses 'hour' window but the spec says "5 minutes".
                // The velocity check looks at mutations within a 5-minute sliding window
                // regardless of the declared window (which controls the data scope).
                const fiveMinAgo = Date.now() - 5 * 60 * 1000
                const recentCount = windowedHistory.filter(dp => dp.timestamp >= fiveMinAgo).length
                if (recentCount >= rule.trigger.threshold) {
                    return {
                        ruleId: rule.ruleId,
                        description: rule.description,
                        action: rule.action,
                        reason: `Agent "${agentId}" produced ${recentCount} mutations in the last 5 minutes (threshold: ${rule.trigger.threshold})`,
                    }
                }
                return null
            }

            default:
                return null
        }
    }
}

// ── Rule Merging ──────────────────────────────────────────────────────────────

/**
 * Merges custom rules with defaults. Custom rules with the same ruleId
 * override the corresponding default rule entirely.
 */
function mergeRules(customRules?: EscalationRule[]): EscalationRule[] {
    if (!customRules || customRules.length === 0) {
        return [...DEFAULT_RULES]
    }

    const customRuleIds = new Set(customRules.map(r => r.ruleId))
    const retained = DEFAULT_RULES.filter(r => !customRuleIds.has(r.ruleId))
    return [...retained, ...customRules]
}

// ── File Loading ──────────────────────────────────────────────────────────────

/**
 * Loads custom escalation rules from `.flint/escalation-rules.json`.
 * If `flint.config.yaml` also has `trust.escalation` rules, those are merged in.
 * YAML rules supplement JSON rules — both sources are combined.
 *
 * Returns the combined rules array, or undefined if neither source exists or
 * both are invalid.
 */
export async function loadEscalationRules(
    projectRoot: string,
): Promise<EscalationRule[] | undefined> {
    const rulesPath = path.join(projectRoot, '.flint', 'escalation-rules.json')

    let jsonRules: EscalationRule[] | undefined

    if (existsSync(rulesPath)) {
        try {
            const raw = await readFile(rulesPath, 'utf-8')
            const data = JSON.parse(raw) as EscalationRulesFile

            if (!Array.isArray(data.rules)) {
                console.warn('[Flint AGV] escalation-rules.json: "rules" is not an array, skipping JSON rules')
            } else {
                // Basic validation: each rule must have ruleId, trigger, and action
                jsonRules = data.rules.filter(rule => {
                    if (!rule.ruleId || !rule.trigger || !rule.action) {
                        console.warn(`[Flint AGV] Skipping invalid rule (missing ruleId, trigger, or action): ${JSON.stringify(rule)}`)
                        return false
                    }
                    return true
                })
                console.log(`[Flint AGV] Loaded ${jsonRules.length} custom escalation rules from ${rulesPath}`)
            }
        } catch (err) {
            console.warn('[Flint AGV] Failed to load escalation-rules.json:', err)
        }
    }

    // Also check flint.config.yaml for trust.escalation rules
    const yamlRules = loadEscalationRulesFromYaml(projectRoot)

    // Merge: JSON rules first, then YAML rules (YAML supplements)
    const combined = [...(jsonRules ?? []), ...(yamlRules ?? [])]

    return combined.length > 0 ? combined : undefined
}

/**
 * Reads `trust.escalation` from `flint.config.yaml` and converts each
 * `YamlEscalationRule` to an `EscalationRule`.
 *
 * Condition string format:  ">= 3"  |  "> 0.6"  |  "5"
 * Comparison operators supported: >=, >, <=, <, =, ==
 * The threshold is the numeric part after the operator.
 *
 * Window string mapping:
 *   "session"      → "session"
 *   "1h" | "hour"  → "hour"
 *   "1d" | "day"   → "day"
 *   "5m" | "5min"  → "session"  (minute windows treated as session-scoped)
 *   <anything else> → "session"
 *
 * Action string mapping:
 *   "require_review"  → { type: 'require_review' }
 *   "alert"           → { type: 'alert', message: rule.message ?? '' }
 *   "downgrade"       → { type: 'downgrade_tier', to: rule.to ?? 'standard' }
 *   "block"           → { type: 'block_mutations' }
 *
 * Rule IDs are generated as "YAML-ESC-001", "YAML-ESC-002", etc.
 *
 * Returns undefined if the YAML file does not exist, has no trust.escalation
 * section, or cannot be parsed.
 */
export function loadEscalationRulesFromYaml(projectRoot: string): EscalationRule[] | undefined {
    const yamlPath = path.join(projectRoot, 'flint.config.yaml')

    if (!existsSync(yamlPath)) {
        return undefined
    }

    try {
        const yamlPkg = _resolveYaml()
        if (!yamlPkg) {
            console.warn('[Flint AGV] yaml package not found — skipping YAML escalation rules')
            return undefined
        }
        const { parse: parseYaml } = yamlPkg
        const raw = readFileSync(yamlPath, 'utf-8')
        const config = parseYaml(raw) as Record<string, unknown>

        if (!config || typeof config !== 'object') return undefined

        const trust = config['trust'] as Record<string, unknown> | undefined
        if (!trust || typeof trust !== 'object') return undefined

        const escalation = trust['escalation']
        if (!Array.isArray(escalation) || escalation.length === 0) return undefined

        const rules: EscalationRule[] = []

        for (let i = 0; i < escalation.length; i++) {
            const entry = escalation[i] as Record<string, unknown>
            if (!entry || typeof entry !== 'object') continue

            const when = entry['when'] as Record<string, string | number> | undefined
            const thenStr = typeof entry['then'] === 'string' ? entry['then'] : undefined

            if (!when || !thenStr) {
                console.warn(`[Flint AGV] Skipping YAML escalation rule at index ${i}: missing 'when' or 'then'`)
                continue
            }

            const trigger = parseYamlTrigger(when)
            if (!trigger) {
                console.warn(`[Flint AGV] Skipping YAML escalation rule at index ${i}: unrecognized condition keys or format`)
                continue
            }

            const action = parseYamlAction(thenStr, entry)
            if (!action) {
                console.warn(`[Flint AGV] Skipping YAML escalation rule at index ${i}: unrecognized action "${thenStr}"`)
                continue
            }

            const ruleId = `YAML-ESC-${String(i + 1).padStart(3, '0')}`
            rules.push({
                ruleId,
                description: typeof entry['description'] === 'string'
                    ? entry['description']
                    : `YAML escalation rule ${ruleId}`,
                trigger,
                action,
            })
        }

        if (rules.length > 0) {
            console.log(`[Flint AGV] Loaded ${rules.length} escalation rules from flint.config.yaml`)
        }

        return rules.length > 0 ? rules : undefined
    } catch (err) {
        console.warn('[Flint AGV] Failed to load escalation rules from flint.config.yaml:', err)
        return undefined
    }
}

// ── YAML Condition/Action Parsers ─────────────────────────────────────────────

/**
 * Parses a YAML `when` map into an EscalationTrigger.
 *
 * Each key in the map maps to an EscalationTriggerType.
 * The value is a condition string like ">= 3" or a plain number.
 * A "window" key specifies the time window.
 *
 * Examples:
 *   { red_count: ">= 3", window: "session" }
 *   { session_risk_avg: "> 0.6" }
 *   { mutation_velocity: ">= 20", window: "5m" }
 */
function parseYamlTrigger(
    when: Record<string, string | number>,
): EscalationTrigger | null {
    const TRIGGER_KEYS: EscalationTriggerType[] = [
        'red_count',
        'amber_count',
        'session_risk_avg',
        'mutation_velocity',
    ]

    let triggerType: EscalationTriggerType | undefined
    let conditionStr: string | number | undefined

    for (const key of TRIGGER_KEYS) {
        if (key in when) {
            triggerType = key
            conditionStr = when[key]
            break
        }
    }

    if (!triggerType || conditionStr === undefined) return null

    const threshold = parseConditionThreshold(conditionStr)
    if (threshold === null) return null

    const rawWindow = when['window']
    const window = parseTimeWindow(typeof rawWindow === 'string' ? rawWindow : 'session')

    return { type: triggerType, threshold, window }
}

/**
 * Parses a condition string like ">= 3", "> 0.6", "5" into a numeric threshold.
 * Returns null if the value cannot be parsed.
 */
function parseConditionThreshold(value: string | number): number | null {
    if (typeof value === 'number') return value

    // Strip comparison operator prefix: >=, >, <=, <, ==, =
    const stripped = value.replace(/^(>=|<=|>|<|==|=)\s*/, '').trim()
    const parsed = parseFloat(stripped)

    return Number.isNaN(parsed) ? null : parsed
}

/**
 * Maps a YAML window string to an EscalationTimeWindow.
 *
 *   "session"            → "session"
 *   "1h" | "hour"        → "hour"
 *   "1d" | "day"         → "day"
 *   "5m" | "5min" | etc. → "session"  (minute windows collapse to session)
 */
function parseTimeWindow(raw: string): EscalationTimeWindow {
    const normalized = raw.toLowerCase().trim()
    if (normalized === 'session') return 'session'
    if (normalized === '1h' || normalized === 'hour') return 'hour'
    if (normalized === '1d' || normalized === 'day') return 'day'
    // Minute windows (5m, 10m, etc.) — fall back to session
    return 'session'
}

/**
 * Converts a YAML `then` string to an EscalationAction.
 *
 * Supported values:
 *   "require_review"  → { type: 'require_review' }
 *   "alert"           → { type: 'alert', message: entry.message ?? '' }
 *   "downgrade"       → { type: 'downgrade_tier', to: entry.to ?? 'standard' }
 *   "block"           → { type: 'block_mutations' }
 */
function parseYamlAction(
    then: string,
    entry: Record<string, unknown>,
): EscalationAction | null {
    switch (then) {
        case 'require_review':
            return { type: 'require_review' }
        case 'alert':
            return {
                type: 'alert',
                message: typeof entry['message'] === 'string' ? entry['message'] : '',
            }
        case 'downgrade':
            return {
                type: 'downgrade_tier',
                to: typeof entry['to'] === 'string' ? entry['to'] : 'standard',
            }
        case 'block':
            return { type: 'block_mutations' }
        default:
            return null
    }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/**
 * Module-level singleton engine instance.
 * The orchestrator imports this directly.
 */
export const escalationEngine = new EscalationEngine()
