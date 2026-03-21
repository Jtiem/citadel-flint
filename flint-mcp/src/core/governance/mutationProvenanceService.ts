/**
 * MutationProvenanceService — flint-mcp/src/core/governance/mutationProvenanceService.ts
 *
 * Records and queries WHO or WHAT caused each AST mutation:
 *   - 'human'     — direct Flint Glass UI interaction
 *   - 'agent'     — AI agent via flint_ast_mutate MCP tool
 *   - 'auto-heal' — IngestionAuditor tier-1 heal pass
 *   - 'auto-fix'  — flint_fix tool or GovernanceOverlay auto-fix
 *   - 'import'    — bulk import / scaffolding operation
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database
 * instance for dependency injection — callers supply the db handle so the
 * service is trivially testable with an in-memory SQLite database.
 *
 * The mutation_provenance table stores a 1:1 record per mutations_ledger row.
 * It does NOT enforce a foreign-key constraint on mutations_ledger.id so that
 * provenance can be recorded even when the ledger is empty (e.g. headless
 * tests), and so the table can be queried independently.
 *
 * Phase: V.2-mp (Mutation Provenance Ledger)
 * Unblocked by: INFRA.2 (Mutations Ledger Table — ONLINE)
 * Required by: V.1-rs (Risk Scoring — PLANNED)
 */

import type Database from 'better-sqlite3'
import type {
    MutationProvenance,
    ProvenanceSource,
    ProvenanceSummary,
    AuditTrailEntry,
} from './types.js'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS mutation_provenance (
    mutation_id             TEXT    PRIMARY KEY,
    timestamp               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    provenance_source       TEXT    NOT NULL CHECK (provenance_source IN (
        'human', 'agent', 'auto-heal', 'auto-fix', 'import'
    )),
    provenance_agent_id     TEXT,
    provenance_session_id   TEXT,
    provenance_reasoning    TEXT,
    provenance_confidence   REAL    CHECK (provenance_confidence IS NULL OR (provenance_confidence >= 0 AND provenance_confidence <= 1))
);

CREATE INDEX IF NOT EXISTS idx_provenance_source     ON mutation_provenance(provenance_source);
CREATE INDEX IF NOT EXISTS idx_provenance_session    ON mutation_provenance(provenance_session_id);
CREATE INDEX IF NOT EXISTS idx_provenance_agent      ON mutation_provenance(provenance_agent_id);
CREATE INDEX IF NOT EXISTS idx_provenance_timestamp  ON mutation_provenance(timestamp);
`

// ---------------------------------------------------------------------------
// Row shape returned by better-sqlite3
// ---------------------------------------------------------------------------

interface ProvenanceRow {
    mutation_id: string
    timestamp: string
    provenance_source: string
    provenance_agent_id: string | null
    provenance_session_id: string | null
    provenance_reasoning: string | null
    provenance_confidence: number | null
}

// Row shape for the joined audit trail query
interface AuditTrailRow extends ProvenanceRow {
    file_path: string
    operation_type: string
    node_id: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToProvenance(row: ProvenanceRow): MutationProvenance {
    return {
        mutationId: row.mutation_id,
        timestamp: row.timestamp,
        provenanceSource: row.provenance_source as ProvenanceSource,
        provenanceAgentId: row.provenance_agent_id,
        provenanceSessionId: row.provenance_session_id,
        provenanceReasoning: row.provenance_reasoning,
        provenanceConfidence: row.provenance_confidence,
    }
}

function rowToAuditTrail(row: AuditTrailRow): AuditTrailEntry {
    return {
        mutationId: row.mutation_id,
        timestamp: row.timestamp,
        provenanceSource: row.provenance_source as ProvenanceSource,
        provenanceAgentId: row.provenance_agent_id,
        provenanceSessionId: row.provenance_session_id,
        provenanceReasoning: row.provenance_reasoning,
        provenanceConfidence: row.provenance_confidence,
        filePath: row.file_path,
        operationType: row.operation_type,
        nodeId: row.node_id,
    }
}

const ALL_SOURCES: ProvenanceSource[] = ['human', 'agent', 'auto-heal', 'auto-fix', 'import']

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MutationProvenanceService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(INIT_SQL)
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Record provenance for a single mutation.
     *
     * @param mutationId       The mutations_ledger.id value this tracks.
     * @param source           Who or what triggered the mutation.
     * @param agentId          MCP client ID, tool name, or agent identifier.
     * @param sessionId        Session UUID (shared with mutations_ledger.session_id).
     * @param reasoning        AI reasoning text, if agent-driven.
     * @param confidence       0-1 confidence score from the AI agent.
     * @param timestamp        ISO 8601 UTC override; generated by DB default when omitted.
     */
    recordProvenance(
        mutationId: string,
        source: ProvenanceSource,
        agentId?: string | null,
        sessionId?: string | null,
        reasoning?: string | null,
        confidence?: number | null,
        timestamp?: string,
    ): void {
        this.db.prepare(`
            INSERT INTO mutation_provenance (
                mutation_id,
                timestamp,
                provenance_source,
                provenance_agent_id,
                provenance_session_id,
                provenance_reasoning,
                provenance_confidence
            ) VALUES (
                ?,
                COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                ?, ?, ?, ?, ?
            )
        `).run(
            mutationId,
            timestamp ?? null,
            source,
            agentId ?? null,
            sessionId ?? null,
            reasoning ?? null,
            confidence ?? null,
        )
    }

    /**
     * Record provenance for multiple mutations in a single transaction.
     * All rows are inserted atomically — either all succeed or none do.
     */
    recordProvenanceBatch(
        entries: Array<{
            mutationId: string
            source: ProvenanceSource
            agentId?: string | null
            sessionId?: string | null
            reasoning?: string | null
            confidence?: number | null
            timestamp?: string
        }>,
    ): void {
        const stmt = this.db.prepare(`
            INSERT INTO mutation_provenance (
                mutation_id,
                timestamp,
                provenance_source,
                provenance_agent_id,
                provenance_session_id,
                provenance_reasoning,
                provenance_confidence
            ) VALUES (
                ?,
                COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                ?, ?, ?, ?, ?
            )
        `)

        const insertMany = this.db.transaction(
            (rows: typeof entries) => {
                for (const row of rows) {
                    stmt.run(
                        row.mutationId,
                        row.timestamp ?? null,
                        row.source,
                        row.agentId ?? null,
                        row.sessionId ?? null,
                        row.reasoning ?? null,
                        row.confidence ?? null,
                    )
                }
            },
        )

        insertMany(entries)
    }

    // -------------------------------------------------------------------------
    // Read — single record
    // -------------------------------------------------------------------------

    /**
     * Retrieve the provenance record for a specific mutation.
     * Returns null if no provenance has been recorded for that mutationId.
     */
    getProvenance(mutationId: string): MutationProvenance | null {
        const row = this.db
            .prepare('SELECT * FROM mutation_provenance WHERE mutation_id = ?')
            .get(mutationId) as ProvenanceRow | undefined

        return row !== undefined ? rowToProvenance(row) : null
    }

    // -------------------------------------------------------------------------
    // Read — filtered queries
    // -------------------------------------------------------------------------

    /**
     * Return all provenance records for a given source type, newest-first.
     * @param source  The ProvenanceSource to filter by.
     * @param limit   Maximum rows to return (default: 100).
     */
    getProvenanceBySource(source: ProvenanceSource, limit = 100): MutationProvenance[] {
        const rows = this.db
            .prepare(`
                SELECT * FROM mutation_provenance
                WHERE provenance_source = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `)
            .all(source, limit) as ProvenanceRow[]

        return rows.map(rowToProvenance)
    }

    // -------------------------------------------------------------------------
    // Aggregations
    // -------------------------------------------------------------------------

    /**
     * Return an aggregate summary:
     *   - total record count
     *   - count per ProvenanceSource
     *   - count in the last 24 hours
     *   - top-5 agent IDs by mutation volume
     */
    getProvenanceSummary(): ProvenanceSummary {
        // Total count
        const totalRow = this.db
            .prepare('SELECT COUNT(*) AS cnt FROM mutation_provenance')
            .get() as { cnt: number }
        const total = totalRow.cnt

        // Count by source
        const sourceRows = this.db
            .prepare(`
                SELECT provenance_source, COUNT(*) AS cnt
                FROM mutation_provenance
                GROUP BY provenance_source
            `)
            .all() as Array<{ provenance_source: string; cnt: number }>

        const bySource: Record<ProvenanceSource, number> = {
            human: 0,
            agent: 0,
            'auto-heal': 0,
            'auto-fix': 0,
            import: 0,
        }
        for (const row of sourceRows) {
            const src = row.provenance_source as ProvenanceSource
            if (ALL_SOURCES.includes(src)) {
                bySource[src] = row.cnt
            }
        }

        // Last 24 hours
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const last24hRow = this.db
            .prepare(`
                SELECT COUNT(*) AS cnt
                FROM mutation_provenance
                WHERE timestamp >= ?
            `)
            .get(since24h) as { cnt: number }
        const last24hCount = last24hRow.cnt

        // Top 5 agents (exclude null agent_id)
        const agentRows = this.db
            .prepare(`
                SELECT provenance_agent_id, COUNT(*) AS cnt
                FROM mutation_provenance
                WHERE provenance_agent_id IS NOT NULL
                GROUP BY provenance_agent_id
                ORDER BY cnt DESC
                LIMIT 5
            `)
            .all() as Array<{ provenance_agent_id: string; cnt: number }>

        const topAgents = agentRows.map((row) => ({
            agentId: row.provenance_agent_id,
            count: row.cnt,
        }))

        return { total, bySource, last24hCount, topAgents }
    }

    /**
     * Return the full chronological audit trail for a file.
     *
     * Performs an INNER JOIN between mutation_provenance and mutations_ledger
     * so only entries with a corresponding ledger row are included.
     *
     * @param filePath   The file path to scope the trail to.
     * @param startDate  Optional ISO 8601 lower bound (inclusive).
     * @param endDate    Optional ISO 8601 upper bound (inclusive).
     */
    getAuditTrail(
        filePath: string,
        startDate?: string,
        endDate?: string,
    ): AuditTrailEntry[] {
        const conditions: string[] = ['ml.file_path = ?']
        const params: unknown[] = [filePath]

        if (startDate !== undefined) {
            conditions.push('mp.timestamp >= ?')
            params.push(startDate)
        }
        if (endDate !== undefined) {
            conditions.push('mp.timestamp <= ?')
            params.push(endDate)
        }

        const where = `WHERE ${conditions.join(' AND ')}`

        const rows = this.db
            .prepare(`
                SELECT
                    mp.mutation_id,
                    mp.timestamp,
                    mp.provenance_source,
                    mp.provenance_agent_id,
                    mp.provenance_session_id,
                    mp.provenance_reasoning,
                    mp.provenance_confidence,
                    ml.file_path,
                    ml.operation_type,
                    ml.node_id
                FROM mutation_provenance mp
                INNER JOIN mutations_ledger ml ON mp.mutation_id = ml.id
                ${where}
                ORDER BY mp.timestamp ASC
            `)
            .all(...params) as AuditTrailRow[]

        return rows.map(rowToAuditTrail)
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Delete provenance records whose timestamp is strictly before `olderThan`
     * (ISO 8601 UTC). Returns the number of rows deleted.
     */
    pruneProvenance(olderThan: string): number {
        const result = this.db
            .prepare('DELETE FROM mutation_provenance WHERE timestamp < ?')
            .run(olderThan)
        return result.changes
    }
}
