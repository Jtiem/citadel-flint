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
 *   - Custom rules loaded from `.bridge/escalation-rules.json` merge with defaults.
 *   - Escalation engine is testable without mocking the full orchestrator.
 *
 * Integration points:
 *   - orchestrator.ts calls recordMutationRisk() after MRS computation.
 *   - orchestrator.ts calls checkEscalation() and applies the result.
 *   - agentPolicy.ts exposes isEscalated() for external queries.
 *
 * Territory: electron/ only — does NOT touch bridge-mcp/src/.
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

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

/** Shape of the optional `.bridge/escalation-rules.json` file. */
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
        trigger: { type: 'mutation_velocity', threshold: 20, window: 'hour' },
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
                    console.warn(`[Bridge AGV] Escalation fired: ${rule.ruleId} for agent "${agentId}" — ${result.reason}`)

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
 * Loads custom escalation rules from `.bridge/escalation-rules.json`.
 * Returns the parsed rules array, or undefined if the file does not exist
 * or is invalid.
 */
export async function loadEscalationRules(
    projectRoot: string,
): Promise<EscalationRule[] | undefined> {
    const rulesPath = path.join(projectRoot, '.bridge', 'escalation-rules.json')

    if (!existsSync(rulesPath)) {
        return undefined
    }

    try {
        const raw = await readFile(rulesPath, 'utf-8')
        const data = JSON.parse(raw) as EscalationRulesFile

        if (!Array.isArray(data.rules)) {
            console.warn('[Bridge AGV] escalation-rules.json: "rules" is not an array, using defaults')
            return undefined
        }

        // Basic validation: each rule must have ruleId, trigger, and action
        const valid = data.rules.filter(rule => {
            if (!rule.ruleId || !rule.trigger || !rule.action) {
                console.warn(`[Bridge AGV] Skipping invalid rule (missing ruleId, trigger, or action): ${JSON.stringify(rule)}`)
                return false
            }
            return true
        })

        console.log(`[Bridge AGV] Loaded ${valid.length} custom escalation rules from ${rulesPath}`)
        return valid
    } catch (err) {
        console.warn('[Bridge AGV] Failed to load escalation-rules.json:', err)
        return undefined
    }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/**
 * Module-level singleton engine instance.
 * The orchestrator imports this directly.
 */
export const escalationEngine = new EscalationEngine()
