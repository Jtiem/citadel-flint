/**
 * AgentRiskService — flint-mcp/src/core/governance/agentRiskService.ts
 *
 * Aggregates MRS scores, mutation provenance records, and override counts
 * grouped by agent_id for the AGV.2 Agent Risk Dashboard.
 *
 * Queries three tables across two databases:
 *   - mutation_provenance (provenance.db) — who caused each mutation
 *   - mutation_risk_scores (provenance.db) — risk score for each mutation
 *   - override_events (overrides.db) — governance overrides by agent
 *
 * Phase: AGV.2 (Agent Risk Dashboard)
 * Dependencies: V.2-mp (Mutation Provenance), V.1-rs (Risk Scoring), GOV.2 (Override Telemetry)
 */

import type Database from 'better-sqlite3'
import type { AgentRiskProfile, AgentRiskSummary } from './types.js'

// ── Row shapes from better-sqlite3 ─────────────────────────────────────────

interface AgentProvenanceRow {
    provenance_agent_id: string
    mutation_count: number
    last_active: string | null
}

interface AgentRiskRow {
    provenance_agent_id: string
    avg_score: number
    red_count: number
    amber_count: number
    green_count: number
}

interface AgentOverrideRow {
    agent_id: string
    override_count: number
}

// ── Service ─────────────────────────────────────────────────────────────────

export class AgentRiskService {
    constructor(
        private readonly provenanceDb: Database.Database,
        private readonly overridesDb: Database.Database,
    ) {}

    /**
     * Returns an aggregated risk summary for all agents in the project.
     *
     * @param projectRoot  Absolute path to scope override queries.
     * @param periodDays   Number of days to look back (default: 7).
     */
    getAgentRiskSummary(projectRoot: string, periodDays: number = 7): AgentRiskSummary {
        const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
        const periodLabel = `last_${periodDays}_days`

        // 1. Get all agents with mutations in period
        const agentRows = this.getAgentProvenance(cutoff)
        if (agentRows.length === 0) {
            return { agents: [], topRiskiest: [], period: periodLabel }
        }

        // 2. Get risk score aggregates per agent
        const riskRows = this.getAgentRiskScores(cutoff)
        const riskMap = new Map<string, AgentRiskRow>()
        for (const r of riskRows) {
            riskMap.set(r.provenance_agent_id, r)
        }

        // 3. Get override counts per agent
        const overrideRows = this.getAgentOverrideCounts(projectRoot, cutoff)
        const overrideMap = new Map<string, number>()
        for (const o of overrideRows) {
            overrideMap.set(o.agent_id, o.override_count)
        }

        // 4. Assemble profiles
        const agents: AgentRiskProfile[] = agentRows.map(row => {
            const risk = riskMap.get(row.provenance_agent_id)
            return {
                agentId: row.provenance_agent_id,
                mutationCount: row.mutation_count,
                avgRiskScore: risk ? Math.round(risk.avg_score * 100) / 100 : 0,
                redCount: risk?.red_count ?? 0,
                amberCount: risk?.amber_count ?? 0,
                greenCount: risk?.green_count ?? 0,
                overrideCount: overrideMap.get(row.provenance_agent_id) ?? 0,
                lastActive: row.last_active,
            }
        })

        // Sort by avgRiskScore descending
        agents.sort((a, b) => b.avgRiskScore - a.avgRiskScore)

        const topRiskiest = agents.slice(0, 5)

        return { agents, topRiskiest, period: periodLabel }
    }

    /**
     * Returns the risk profile for a single agent.
     */
    getAgentProfile(agentId: string, projectRoot: string, periodDays: number = 7): AgentRiskProfile | null {
        const summary = this.getAgentRiskSummary(projectRoot, periodDays)
        return summary.agents.find(a => a.agentId === agentId) ?? null
    }

    // ── Private query helpers ───────────────────────────────────────────────

    private getAgentProvenance(cutoff: string): AgentProvenanceRow[] {
        try {
            const stmt = this.provenanceDb.prepare(`
                SELECT
                    provenance_agent_id,
                    COUNT(*) as mutation_count,
                    MAX(timestamp) as last_active
                FROM mutation_provenance
                WHERE provenance_agent_id IS NOT NULL
                  AND timestamp >= ?
                GROUP BY provenance_agent_id
            `)
            return stmt.all(cutoff) as AgentProvenanceRow[]
        } catch {
            return []
        }
    }

    private getAgentRiskScores(cutoff: string): AgentRiskRow[] {
        try {
            // Join provenance with risk scores to get per-agent risk aggregates.
            // mutation_risk_scores.mutation_id = mutation_provenance.mutation_id
            const stmt = this.provenanceDb.prepare(`
                SELECT
                    p.provenance_agent_id,
                    AVG(r.score) as avg_score,
                    SUM(CASE WHEN r.tier = 'critical' THEN 1 ELSE 0 END) as red_count,
                    SUM(CASE WHEN r.tier = 'high' THEN 1 ELSE 0 END) as amber_count,
                    SUM(CASE WHEN r.tier IN ('low', 'medium') THEN 1 ELSE 0 END) as green_count
                FROM mutation_provenance p
                INNER JOIN mutation_risk_scores r ON r.mutation_id = p.mutation_id
                WHERE p.provenance_agent_id IS NOT NULL
                  AND p.timestamp >= ?
                GROUP BY p.provenance_agent_id
            `)
            return stmt.all(cutoff) as AgentRiskRow[]
        } catch {
            return []
        }
    }

    private getAgentOverrideCounts(projectRoot: string, cutoff: string): AgentOverrideRow[] {
        try {
            const stmt = this.overridesDb.prepare(`
                SELECT
                    agent_id,
                    COUNT(*) as override_count
                FROM override_events
                WHERE agent_id IS NOT NULL
                  AND project_root = ?
                  AND timestamp >= ?
                GROUP BY agent_id
            `)
            return stmt.all(projectRoot, cutoff) as AgentOverrideRow[]
        } catch {
            return []
        }
    }
}
