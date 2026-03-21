/**
 * OverrideTelemetryService — flint-mcp/src/core/governance/overrideTelemetryService.ts
 *
 * Records and queries every governance rule override (bypass, disable,
 * severity downgrade) in the override_events SQLite table.
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database
 * instance for dependency injection — callers supply the db handle so the
 * service is trivially testable with an in-memory SQLite database.
 *
 * The override_events table is independent — no foreign-key constraints on
 * other governance tables — so it can be queried or pruned independently.
 *
 * Phase: GOV.2 (Override Telemetry)
 * Unblocked by: INFRA.1 (Governance Events Table — ONLINE)
 * Required by: Glass StatusBar "Overrides (N)" badge, GOV.4 (Anomaly Detection)
 */

import type Database from 'better-sqlite3'
import type { OverrideEvent, OverrideSummary } from './types.js'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS override_events (
    id              TEXT    PRIMARY KEY,
    node_id         TEXT,
    rule_id         TEXT    NOT NULL,
    session_id      TEXT,
    agent_id        TEXT,
    timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    project_root    TEXT    NOT NULL,
    reason          TEXT
);

CREATE INDEX IF NOT EXISTS idx_override_session   ON override_events(session_id);
CREATE INDEX IF NOT EXISTS idx_override_rule      ON override_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_override_timestamp ON override_events(timestamp);
`

// ---------------------------------------------------------------------------
// Row shape returned by better-sqlite3
// ---------------------------------------------------------------------------

interface OverrideRow {
    id: string
    node_id: string | null
    rule_id: string
    session_id: string | null
    agent_id: string | null
    timestamp: string
    project_root: string
    reason: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToOverrideEvent(row: OverrideRow): OverrideEvent {
    return {
        id: row.id,
        nodeId: row.node_id,
        ruleId: row.rule_id,
        sessionId: row.session_id,
        agentId: row.agent_id,
        timestamp: row.timestamp,
        projectRoot: row.project_root,
        reason: row.reason,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OverrideTelemetryService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(INIT_SQL)
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Record a single override event.
     *
     * @param override  Full OverrideEvent object. The `timestamp` field is
     *                  used as-is when provided; when the event has no
     *                  explicit timestamp the DB default fires (UTC now).
     */
    recordOverride(override: OverrideEvent): void {
        this.db.prepare(`
            INSERT INTO override_events (
                id, node_id, rule_id, session_id, agent_id,
                timestamp, project_root, reason
            ) VALUES (
                ?, ?, ?, ?, ?,
                COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                ?, ?
            )
        `).run(
            override.id,
            override.nodeId ?? null,
            override.ruleId,
            override.sessionId ?? null,
            override.agentId ?? null,
            override.timestamp ?? null,
            override.projectRoot,
            override.reason ?? null,
        )
    }

    // -------------------------------------------------------------------------
    // Read — by session
    // -------------------------------------------------------------------------

    /**
     * Return all override events for a given session, newest-first.
     *
     * @param sessionId  The session UUID to filter by.
     * @param limit      Maximum rows to return (default: 100).
     */
    getOverridesBySession(sessionId: string, limit = 100): OverrideEvent[] {
        const rows = this.db
            .prepare(`
                SELECT * FROM override_events
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `)
            .all(sessionId, limit) as OverrideRow[]

        return rows.map(rowToOverrideEvent)
    }

    // -------------------------------------------------------------------------
    // Read — by rule
    // -------------------------------------------------------------------------

    /**
     * Return all override events for a given rule ID, newest-first.
     *
     * @param ruleId  The governance rule ID to filter by.
     * @param limit   Maximum rows to return (default: 100).
     */
    getOverridesByRule(ruleId: string, limit = 100): OverrideEvent[] {
        const rows = this.db
            .prepare(`
                SELECT * FROM override_events
                WHERE rule_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `)
            .all(ruleId, limit) as OverrideRow[]

        return rows.map(rowToOverrideEvent)
    }

    // -------------------------------------------------------------------------
    // Aggregation — summary
    // -------------------------------------------------------------------------

    /**
     * Return an aggregate summary for a project:
     *   - total override count for this project_root
     *   - top 10 rules by override count
     *   - top 10 sessions by override count
     *   - count in the last 24 hours
     *   - timestamp of the most recent override
     *
     * @param projectRoot  Absolute path to scope the summary.
     */
    getOverrideSummary(projectRoot: string): OverrideSummary {
        // Total count
        const totalRow = this.db
            .prepare('SELECT COUNT(*) AS cnt FROM override_events WHERE project_root = ?')
            .get(projectRoot) as { cnt: number }
        const totalOverrides = totalRow.cnt

        // By rule (top 10)
        const ruleRows = this.db
            .prepare(`
                SELECT rule_id, COUNT(*) AS cnt
                FROM override_events
                WHERE project_root = ?
                GROUP BY rule_id
                ORDER BY cnt DESC
                LIMIT 10
            `)
            .all(projectRoot) as Array<{ rule_id: string; cnt: number }>

        const byRule = ruleRows.map((row) => ({
            ruleId: row.rule_id,
            count: row.cnt,
        }))

        // By session (top 10, exclude null session_id)
        const sessionRows = this.db
            .prepare(`
                SELECT session_id, COUNT(*) AS cnt
                FROM override_events
                WHERE project_root = ? AND session_id IS NOT NULL
                GROUP BY session_id
                ORDER BY cnt DESC
                LIMIT 10
            `)
            .all(projectRoot) as Array<{ session_id: string; cnt: number }>

        const bySession = sessionRows.map((row) => ({
            sessionId: row.session_id,
            count: row.cnt,
        }))

        // Last 24 hours
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const last24hRow = this.db
            .prepare(`
                SELECT COUNT(*) AS cnt
                FROM override_events
                WHERE project_root = ? AND timestamp >= ?
            `)
            .get(projectRoot, since24h) as { cnt: number }
        const last24hCount = last24hRow.cnt

        // Most recent override
        const latestRow = this.db
            .prepare(`
                SELECT timestamp FROM override_events
                WHERE project_root = ?
                ORDER BY timestamp DESC
                LIMIT 1
            `)
            .get(projectRoot) as { timestamp: string } | undefined
        const lastOverrideAt = latestRow?.timestamp ?? null

        return {
            totalOverrides,
            byRule,
            bySession,
            last24hCount,
            lastOverrideAt,
        }
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Delete override events older than `retentionDays` days.
     * Returns the number of rows deleted.
     *
     * @param retentionDays  Number of days to retain. Events older than
     *                       `now - retentionDays` are deleted.
     */
    pruneOverrides(retentionDays: number): number {
        const cutoff = new Date(
            Date.now() - retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString()
        const result = this.db
            .prepare('DELETE FROM override_events WHERE timestamp < ?')
            .run(cutoff)
        return result.changes
    }
}
