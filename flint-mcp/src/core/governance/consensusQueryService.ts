/**
 * consensusQueryService.ts — V.4 Epistemic Consensus Gate (read-only MCP queries)
 *
 * Provides read-only query methods over the consensus_records SQLite table.
 * The table is created by electron/store.ts — this service does no DDL.
 */

import type Database from 'better-sqlite3'
import type {
    ConsensusRecord,
    ConsensusReportSummary,
    ConsensusOutcome,
    EvaluatorVerdict,
} from './types.js'

// Helper to map a raw SQLite row to a ConsensusRecord
function rowToRecord(row: Record<string, unknown>): ConsensusRecord {
    const primaryVerdict: EvaluatorVerdict = {
        evaluator: 'primary',
        judgment: row.primary_judgment as ConsensusRecord['primaryVerdict']['judgment'],
        reasoning: row.primary_reasoning as string,
        confidence: row.primary_confidence as number | null,
        durationMs: row.primary_duration_ms as number,
    }
    const secondaryVerdict: EvaluatorVerdict = {
        evaluator: 'secondary',
        judgment: row.secondary_judgment as ConsensusRecord['secondaryVerdict']['judgment'],
        reasoning: row.secondary_reasoning as string,
        confidence: row.secondary_confidence as number | null,
        durationMs: row.secondary_duration_ms as number,
    }
    return {
        id: row.id as string,
        mutationId: row.mutation_id as string | null,
        toolName: row.tool_name as string,
        toolInput: row.tool_input_json as string,
        mrsScore: row.mrs_score as number,
        mrsTier: row.mrs_tier as 'amber' | 'red',
        primaryVerdict,
        secondaryVerdict,
        outcome: row.outcome as ConsensusOutcome,
        timestamp: row.timestamp as string,
        sessionId: row.session_id as string | null,
        agentId: row.agent_id as string,
        domain: row.domain as string,
    }
}

export class ConsensusQueryService {
    constructor(private readonly db: Database.Database) {}

    getSummary(): ConsensusReportSummary {
        // Check if table exists (it's created by electron/store.ts, may not exist in MCP-only context)
        const tableExists = this.db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='consensus_records'`,
            )
            .get()

        if (!tableExists) {
            return {
                totalEvaluations: 0,
                byOutcome: {
                    agree_approve: 0,
                    agree_reject: 0,
                    disagree: 0,
                    error: 0,
                    skipped: 0,
                },
                disagreementRate: 0,
                avgSecondaryDurationMs: 0,
                last24hCount: 0,
                recentDisagreements: [],
            }
        }

        const total = (
            this.db.prepare(`SELECT COUNT(*) as count FROM consensus_records`).get() as {
                count: number
            }
        ).count

        const outcomeCounts = this.db
            .prepare(`SELECT outcome, COUNT(*) as count FROM consensus_records GROUP BY outcome`)
            .all() as Array<{ outcome: string; count: number }>

        const byOutcome: Record<ConsensusOutcome, number> = {
            agree_approve: 0,
            agree_reject: 0,
            disagree: 0,
            error: 0,
            skipped: 0,
        }
        for (const row of outcomeCounts) {
            if (row.outcome in byOutcome) {
                byOutcome[row.outcome as ConsensusOutcome] = row.count
            }
        }

        const disagreementRate = total > 0 ? byOutcome.disagree / total : 0

        const avgDuration = (
            this.db
                .prepare(
                    `SELECT AVG(secondary_duration_ms) as avg FROM consensus_records WHERE outcome NOT IN ('error', 'skipped')`,
                )
                .get() as { avg: number | null }
        ).avg ?? 0

        const last24h = (
            this.db
                .prepare(
                    `SELECT COUNT(*) as count FROM consensus_records WHERE timestamp >= datetime('now', '-24 hours')`,
                )
                .get() as { count: number }
        ).count

        const recentDisagreementRows = this.db
            .prepare(
                `SELECT * FROM consensus_records WHERE outcome = 'disagree' ORDER BY timestamp DESC LIMIT 10`,
            )
            .all() as Array<Record<string, unknown>>

        return {
            totalEvaluations: total,
            byOutcome,
            disagreementRate,
            avgSecondaryDurationMs: avgDuration,
            last24hCount: last24h,
            recentDisagreements: recentDisagreementRows.map(rowToRecord),
        }
    }

    getBySession(sessionId: string, limit = 20): ConsensusRecord[] {
        const safeLimit = Math.min(limit, 100)
        const rows = this.db
            .prepare(
                `SELECT * FROM consensus_records WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(sessionId, safeLimit) as Array<Record<string, unknown>>
        return rows.map(rowToRecord)
    }

    getByAgent(agentId: string, limit = 20): ConsensusRecord[] {
        const safeLimit = Math.min(limit, 100)
        const rows = this.db
            .prepare(
                `SELECT * FROM consensus_records WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(agentId, safeLimit) as Array<Record<string, unknown>>
        return rows.map(rowToRecord)
    }

    getDisagreements(limit = 20): ConsensusRecord[] {
        const safeLimit = Math.min(limit, 100)
        const rows = this.db
            .prepare(
                `SELECT * FROM consensus_records WHERE outcome = 'disagree' ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(safeLimit) as Array<Record<string, unknown>>
        return rows.map(rowToRecord)
    }

    pruneRecords(olderThan: string): number {
        const result = this.db
            .prepare(`DELETE FROM consensus_records WHERE timestamp < ?`)
            .run(olderThan)
        return result.changes
    }
}
