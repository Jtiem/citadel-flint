/**
 * TrustTierService — flint-mcp/src/core/governance/trustTierService.ts
 *
 * AGV.4: Dynamic Agent Trust Tiers.
 *
 * Extends the static 4-tier AGV.1 system (restricted/standard/elevated/admin)
 * with behavioral tracking. Agents earn or lose trust tiers based on session
 * history — red mutation counts, override counts, and escalation events.
 *
 * All data is persisted in the `agent_trust` SQLite table inside the
 * project-scoped provenance.db. This module runs in the MCP server process
 * (Node.js). It MUST NOT be imported anywhere inside src/.
 */

import type Database from 'better-sqlite3'

// ── Types ────────────────────────────────────────────────────────────────────

export type TrustTier = 'restricted' | 'standard' | 'elevated' | 'admin'

export interface AgentTrustRecord {
    agentId: string
    currentTier: TrustTier
    sessionCount: number
    redMutationCount: number
    overrideCount: number
    escalationCount: number
    lastEscalationAt: string | null
    promotedAt: string | null
    demotedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface SessionStats {
    redMutationCount: number
    overrideCount: number
    escalationTriggered: boolean
}

// ── DDL ──────────────────────────────────────────────────────────────────────

const DDL = `
CREATE TABLE IF NOT EXISTS agent_trust (
    agent_id            TEXT    PRIMARY KEY,
    current_tier        TEXT    NOT NULL DEFAULT 'restricted'
        CHECK (current_tier IN ('restricted', 'standard', 'elevated', 'admin')),
    session_count       INTEGER NOT NULL DEFAULT 0,
    red_mutation_count  INTEGER NOT NULL DEFAULT 0,
    override_count      INTEGER NOT NULL DEFAULT 0,
    escalation_count    INTEGER NOT NULL DEFAULT 0,
    last_escalation_at  TEXT,
    promoted_at         TEXT,
    demoted_at          TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`

// ── Tier ordering ────────────────────────────────────────────────────────────

const TIER_ORDER: TrustTier[] = ['restricted', 'standard', 'elevated', 'admin']

function tierIndex(tier: TrustTier): number {
    return TIER_ORDER.indexOf(tier)
}

// ── Service ──────────────────────────────────────────────────────────────────

export class TrustTierService {
    private db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(DDL)
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private now(): string {
        return new Date().toISOString()
    }

    private ensureAgent(agentId: string): void {
        const exists = this.db.prepare('SELECT 1 FROM agent_trust WHERE agent_id = ?').get(agentId)
        if (!exists) {
            this.db.prepare(
                `INSERT INTO agent_trust (agent_id, current_tier, created_at, updated_at)
                 VALUES (?, 'restricted', ?, ?)`
            ).run(agentId, this.now(), this.now())
        }
    }

    private rowToRecord(row: Record<string, unknown>): AgentTrustRecord {
        return {
            agentId: row.agent_id as string,
            currentTier: row.current_tier as TrustTier,
            sessionCount: row.session_count as number,
            redMutationCount: row.red_mutation_count as number,
            overrideCount: row.override_count as number,
            escalationCount: row.escalation_count as number,
            lastEscalationAt: (row.last_escalation_at as string) || null,
            promotedAt: (row.promoted_at as string) || null,
            demotedAt: (row.demoted_at as string) || null,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns the full trust record for an agent.
     * Creates the record at 'restricted' if the agent has never been seen.
     */
    getAgentTrustProfile(agentId: string): AgentTrustRecord {
        this.ensureAgent(agentId)
        const row = this.db.prepare('SELECT * FROM agent_trust WHERE agent_id = ?').get(agentId) as Record<string, unknown>
        return this.rowToRecord(row)
    }

    /**
     * Lists all agent trust records, ordered by tier (highest first) then session count.
     */
    listAll(): AgentTrustRecord[] {
        const rows = this.db.prepare(`
            SELECT * FROM agent_trust
            ORDER BY
                CASE current_tier
                    WHEN 'admin' THEN 3
                    WHEN 'elevated' THEN 2
                    WHEN 'standard' THEN 1
                    WHEN 'restricted' THEN 0
                END DESC,
                session_count DESC
        `).all() as Record<string, unknown>[]
        return rows.map(r => this.rowToRecord(r))
    }

    /**
     * Evaluate whether an agent qualifies for promotion.
     * - restricted -> standard: 3+ sessions, 0 red mutations, 0 overrides
     * - standard -> elevated: 10+ sessions, 0 red mutations, 0 escalations
     * - elevated -> admin: NEVER automatic (manual only)
     *
     * Returns the new tier if promoted, or the current tier if no change.
     */
    evaluatePromotion(agentId: string): TrustTier {
        const record = this.getAgentTrustProfile(agentId)

        if (record.currentTier === 'restricted') {
            if (record.sessionCount >= 3 && record.redMutationCount === 0 && record.overrideCount === 0) {
                return this.setTier(agentId, 'standard', 'promotion')
            }
        } else if (record.currentTier === 'standard') {
            if (record.sessionCount >= 10 && record.redMutationCount === 0 && record.escalationCount === 0) {
                return this.setTier(agentId, 'elevated', 'promotion')
            }
        }
        // elevated -> admin: never automatic
        return record.currentTier
    }

    /**
     * Evaluate whether an agent should be demoted.
     * - Any escalation trigger -> demote one tier
     * - 3+ red mutations in a single session -> demote to restricted
     *
     * Called with session-level stats.
     * Returns the new tier if demoted, or the current tier if no change.
     */
    evaluateDemotion(agentId: string, sessionStats: SessionStats): TrustTier {
        const record = this.getAgentTrustProfile(agentId)

        // 3+ red mutations in a single session -> restricted
        if (sessionStats.redMutationCount >= 3) {
            if (record.currentTier !== 'restricted') {
                return this.setTier(agentId, 'restricted', 'demotion')
            }
            return record.currentTier
        }

        // Escalation trigger -> demote one tier
        if (sessionStats.escalationTriggered) {
            const idx = tierIndex(record.currentTier)
            if (idx > 0) {
                const newTier = TIER_ORDER[idx - 1]
                return this.setTier(agentId, newTier, 'demotion')
            }
        }

        return record.currentTier
    }

    /**
     * Called at session end. Updates counters and evaluates promotion/demotion.
     * Returns the updated trust record.
     */
    recordSessionEnd(agentId: string, sessionStats: SessionStats): AgentTrustRecord {
        this.ensureAgent(agentId)
        const ts = this.now()

        // Update counters
        this.db.prepare(`
            UPDATE agent_trust SET
                session_count = session_count + 1,
                red_mutation_count = red_mutation_count + ?,
                override_count = override_count + ?,
                escalation_count = escalation_count + ?,
                last_escalation_at = CASE WHEN ? THEN ? ELSE last_escalation_at END,
                updated_at = ?
            WHERE agent_id = ?
        `).run(
            sessionStats.redMutationCount,
            sessionStats.overrideCount,
            sessionStats.escalationTriggered ? 1 : 0,
            sessionStats.escalationTriggered ? 1 : 0,
            ts,
            ts,
            agentId,
        )

        // Evaluate demotion first (takes priority)
        const beforeDemotion = this.getAgentTrustProfile(agentId).currentTier
        this.evaluateDemotion(agentId, sessionStats)
        const afterDemotion = this.getAgentTrustProfile(agentId).currentTier

        // Only evaluate promotion if no demotion occurred this session
        if (beforeDemotion === afterDemotion) {
            this.evaluatePromotion(agentId)
        }

        return this.getAgentTrustProfile(agentId)
    }

    /**
     * Reset an agent to restricted tier.
     */
    resetTrust(agentId: string): AgentTrustRecord {
        this.ensureAgent(agentId)
        const ts = this.now()
        this.db.prepare(`
            UPDATE agent_trust SET
                current_tier = 'restricted',
                session_count = 0,
                red_mutation_count = 0,
                override_count = 0,
                escalation_count = 0,
                last_escalation_at = NULL,
                promoted_at = NULL,
                demoted_at = ?,
                updated_at = ?
            WHERE agent_id = ?
        `).run(ts, ts, agentId)
        return this.getAgentTrustProfile(agentId)
    }

    /**
     * Manual demotion by one tier. Cannot demote below restricted.
     */
    manualDemote(agentId: string): AgentTrustRecord {
        this.ensureAgent(agentId)
        const record = this.getAgentTrustProfile(agentId)
        const idx = tierIndex(record.currentTier)
        if (idx <= 0) return record // already restricted
        const newTier = TIER_ORDER[idx - 1]
        this.setTier(agentId, newTier, 'demotion')
        return this.getAgentTrustProfile(agentId)
    }

    /**
     * Manual promotion to any tier (including admin).
     * Only allows promotion upward; use resetTrust for demotion to restricted.
     */
    manualPromote(agentId: string, targetTier: TrustTier): AgentTrustRecord {
        this.ensureAgent(agentId)
        const record = this.getAgentTrustProfile(agentId)
        const currentIdx = tierIndex(record.currentTier)
        const targetIdx = tierIndex(targetTier)

        if (targetIdx <= currentIdx) {
            // Not a promotion — return current record unchanged
            return record
        }

        this.setTier(agentId, targetTier, 'promotion')
        return this.getAgentTrustProfile(agentId)
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private setTier(agentId: string, newTier: TrustTier, reason: 'promotion' | 'demotion'): TrustTier {
        const ts = this.now()
        const promotedAt = reason === 'promotion' ? ts : undefined
        const demotedAt = reason === 'demotion' ? ts : undefined

        this.db.prepare(`
            UPDATE agent_trust SET
                current_tier = ?,
                promoted_at = COALESCE(?, promoted_at),
                demoted_at = COALESCE(?, demoted_at),
                updated_at = ?
            WHERE agent_id = ?
        `).run(newTier, promotedAt ?? null, demotedAt ?? null, ts, agentId)

        return newTier
    }
}
