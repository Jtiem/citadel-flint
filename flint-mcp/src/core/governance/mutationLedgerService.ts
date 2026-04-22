/**
 * MutationLedgerService — flint-mcp/src/core/governance/mutationLedgerService.ts
 *
 * Records every AST mutation committed through Flint MCP into the
 * mutations_ledger SQLite table. Provides full forensic provenance for
 * downstream consumers: V.2-mp (Mutation Provenance Ledger), V.1-rs (Risk
 * Scoring), GOV.3 (Session Validation), and the Glass Governance Dashboard.
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database
 * instance for dependency injection — callers supply the db handle, making
 * the service trivially testable with an in-memory SQLite database.
 */

import type Database from 'better-sqlite3'
import type {
    MutationLedgerEntry,
    MutationFilters,
    MutationOperationType,
    MutationSource,
} from './types.js'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS mutations_ledger (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  timestamp           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  file_path           TEXT NOT NULL,
  node_id             TEXT,
  operation_type      TEXT NOT NULL CHECK (operation_type IN (
    'updateProp', 'updateClassName', 'updateTextContent',
    'move', 'inject', 'fixToken', 'assembleLayout',
    'insertNode', 'deleteNode', 'wrapNode',
    'addClass', 'removeClass', 'crossFileMove'
  )),
  source              TEXT NOT NULL CHECK (source IN (
    'ai_orchestrator', 'mcp_tool', 'user_action', 'auto_fix'
  )),
  source_intent_hash  TEXT,
  registry_artifact_id TEXT,
  before_snapshot     TEXT,
  after_snapshot      TEXT,
  session_id          TEXT,
  approved_by         TEXT,
  approved_at         TEXT,
  justification       TEXT,
  metadata            TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mutations_timestamp  ON mutations_ledger(timestamp);
CREATE INDEX IF NOT EXISTS idx_mutations_file       ON mutations_ledger(file_path);
CREATE INDEX IF NOT EXISTS idx_mutations_node       ON mutations_ledger(node_id);
CREATE INDEX IF NOT EXISTS idx_mutations_source     ON mutations_ledger(source);
CREATE INDEX IF NOT EXISTS idx_mutations_session    ON mutations_ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_mutations_approved   ON mutations_ledger(approved_at);
`

// ---------------------------------------------------------------------------
// Row shape returned by better-sqlite3
// ---------------------------------------------------------------------------

interface MutationRow {
    id: string
    timestamp: string
    file_path: string
    node_id: string | null
    operation_type: string
    source: string
    source_intent_hash: string | null
    registry_artifact_id: string | null
    before_snapshot: string | null
    after_snapshot: string | null
    session_id: string | null
    approved_by: string | null
    justification: string | null
    metadata: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEntry(row: MutationRow): MutationLedgerEntry {
    let metadata: Record<string, unknown> = {}
    try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>
    } catch {
        // leave as empty object if stored value is malformed
    }

    const entry: MutationLedgerEntry = {
        id: row.id,
        timestamp: row.timestamp,
        filePath: row.file_path,
        operationType: row.operation_type as MutationOperationType,
        source: row.source as MutationSource,
        metadata,
    }

    if (row.node_id !== null) entry.nodeId = row.node_id
    if (row.source_intent_hash !== null) entry.sourceIntentHash = row.source_intent_hash
    if (row.registry_artifact_id !== null) entry.registryArtifactId = row.registry_artifact_id
    if (row.before_snapshot !== null) entry.beforeSnapshot = row.before_snapshot
    if (row.after_snapshot !== null) entry.afterSnapshot = row.after_snapshot
    if (row.session_id !== null) entry.sessionId = row.session_id
    if (row.approved_by !== null) entry.approvedBy = row.approved_by
    if (row.justification !== null) entry.justification = row.justification

    return entry
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MutationLedgerService {
    private readonly db: Database.Database
    private readonly stmtInsert: ReturnType<Database.Database['prepare']>
    private readonly stmtGetBySession: ReturnType<Database.Database['prepare']>
    private readonly stmtGetRecent: ReturnType<Database.Database['prepare']>
    private readonly stmtCountByType: ReturnType<Database.Database['prepare']>
    private readonly stmtCountByFile: ReturnType<Database.Database['prepare']>
    private readonly stmtPrune: ReturnType<Database.Database['prepare']>

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(INIT_SQL)
        this.stmtInsert = this.db.prepare(`
            INSERT INTO mutations_ledger (
                id,
                timestamp,
                file_path,
                node_id,
                operation_type,
                source,
                source_intent_hash,
                registry_artifact_id,
                before_snapshot,
                after_snapshot,
                session_id,
                approved_by,
                justification,
                metadata
            ) VALUES (
                COALESCE(?, lower(hex(randomblob(16)))),
                COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                COALESCE(?, '{}')
            )
        `)
        this.stmtGetBySession = this.db.prepare(
            'SELECT * FROM mutations_ledger WHERE session_id = ? ORDER BY timestamp ASC',
        )
        this.stmtGetRecent = this.db.prepare(
            'SELECT * FROM mutations_ledger ORDER BY timestamp DESC LIMIT ?',
        )
        this.stmtCountByType = this.db.prepare(`
            SELECT operation_type, COUNT(*) AS cnt
            FROM mutations_ledger
            WHERE timestamp >= ?
            GROUP BY operation_type
        `)
        this.stmtCountByFile = this.db.prepare(`
            SELECT file_path, COUNT(*) AS cnt
            FROM mutations_ledger
            WHERE timestamp >= ?
            GROUP BY file_path
            ORDER BY cnt DESC
            LIMIT ?
        `)
        this.stmtPrune = this.db.prepare(
            'DELETE FROM mutations_ledger WHERE timestamp < ?',
        )
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Insert a single mutation record. The `id` and `timestamp` fields are
     * optional — the database DEFAULT expressions generate them when omitted.
     */
    recordMutation(entry: Omit<MutationLedgerEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): void {
        this.stmtInsert.run([
            entry.id ?? null,
            entry.timestamp ?? null,
            entry.filePath,
            entry.nodeId ?? null,
            entry.operationType,
            entry.source,
            entry.sourceIntentHash ?? null,
            entry.registryArtifactId ?? null,
            entry.beforeSnapshot ?? null,
            entry.afterSnapshot ?? null,
            entry.sessionId ?? null,
            entry.approvedBy ?? null,
            entry.justification ?? null,
            entry.metadata && Object.keys(entry.metadata).length > 0
                ? JSON.stringify(entry.metadata)
                : null,
        ])
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /**
     * Query mutations with optional filters. All filters are AND-composed.
     */
    queryMutations(filters: MutationFilters = {}): MutationLedgerEntry[] {
        const conditions: string[] = []
        const params: unknown[] = []

        if (filters.since) {
            conditions.push('timestamp >= ?')
            params.push(filters.since)
        }
        if (filters.until) {
            conditions.push('timestamp <= ?')
            params.push(filters.until)
        }
        if (filters.filePath) {
            conditions.push('file_path = ?')
            params.push(filters.filePath)
        }
        if (filters.nodeId) {
            conditions.push('node_id = ?')
            params.push(filters.nodeId)
        }
        if (filters.operationType) {
            conditions.push('operation_type = ?')
            params.push(filters.operationType)
        }
        if (filters.source) {
            conditions.push('source = ?')
            params.push(filters.source)
        }
        if (filters.sessionId) {
            conditions.push('session_id = ?')
            params.push(filters.sessionId)
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        // SQLite requires LIMIT when OFFSET is present. When only an offset is
        // requested (no explicit limit), use -1 which SQLite treats as unlimited.
        let pagination = ''
        if (filters.limit !== undefined && filters.offset !== undefined) {
            pagination = `LIMIT ${filters.limit} OFFSET ${filters.offset}`
        } else if (filters.limit !== undefined) {
            pagination = `LIMIT ${filters.limit}`
        } else if (filters.offset !== undefined) {
            pagination = `LIMIT -1 OFFSET ${filters.offset}`
        }

        const sql = `
            SELECT * FROM mutations_ledger
            ${where}
            ORDER BY timestamp DESC
            ${pagination}
        `

        const rows = this.db.prepare(sql).all(...params) as MutationRow[]
        return rows.map(rowToEntry)
    }

    /**
     * Return all mutations belonging to a session, oldest-first.
     */
    getMutationsBySession(sessionId: string): MutationLedgerEntry[] {
        const rows = this.stmtGetBySession.all(sessionId) as MutationRow[]
        return rows.map(rowToEntry)
    }

    /**
     * Return the most recent N mutations, newest-first.
     */
    getRecentMutations(limit: number): MutationLedgerEntry[] {
        const rows = this.stmtGetRecent.all(limit) as MutationRow[]
        return rows.map(rowToEntry)
    }

    // -------------------------------------------------------------------------
    // Aggregations
    // -------------------------------------------------------------------------

    /**
     * Return mutation counts keyed by operation_type, for all rows whose
     * timestamp is >= `since` (ISO 8601 UTC string).
     */
    getMutationCountsByType(since: string): Record<string, number> {
        const rows = this.stmtCountByType.all(since) as Array<{ operation_type: string; cnt: number }>

        const result: Record<string, number> = {}
        for (const row of rows) {
            result[row.operation_type] = row.cnt
        }
        return result
    }

    /**
     * Return the top N most-mutated file paths since `since`, descending by
     * mutation count.
     */
    getMutationCountsByFile(
        since: string,
        limit: number,
    ): Array<{ filePath: string; count: number }> {
        const rows = this.stmtCountByFile.all([since, limit]) as Array<{ file_path: string; cnt: number }>
        return rows.map((row) => ({ filePath: row.file_path, count: row.cnt }))
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Delete all mutations whose timestamp is strictly before `olderThan`
     * (ISO 8601 UTC). Returns the number of rows deleted.
     */
    pruneMutations(olderThan: string): number {
        const result = this.stmtPrune.run(olderThan)
        return result.changes
    }
}
