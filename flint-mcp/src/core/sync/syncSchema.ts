/**
 * SYNC.1 — SQLite schema for Figma Token Sync infrastructure.
 *
 * Tables: figma_connections, token_source, sync_history, pending_conflicts
 *
 * Constructor takes a better-sqlite3 Database instance (dependency injection).
 * DDL uses CREATE TABLE IF NOT EXISTS for idempotent initialization.
 */

import type Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS figma_connections (
    id                      TEXT    PRIMARY KEY,
    project_root            TEXT    NOT NULL,
    figma_file_key          TEXT    NOT NULL,
    figma_file_name         TEXT    NOT NULL DEFAULT '',
    access_token_encrypted  TEXT    NOT NULL,
    refresh_token_encrypted TEXT,
    token_expiry            TEXT,
    connected_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_sync_at            TEXT,
    status                  TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_figma_connections_project ON figma_connections(project_root);
CREATE INDEX IF NOT EXISTS idx_figma_connections_status  ON figma_connections(status);

CREATE TABLE IF NOT EXISTS token_source (
    id                  TEXT    PRIMARY KEY,
    project_root        TEXT    NOT NULL,
    token_name          TEXT    NOT NULL,
    token_value         TEXT    NOT NULL,
    source              TEXT    NOT NULL DEFAULT 'local' CHECK (source IN ('figma', 'local', 'merged')),
    figma_variable_id   TEXT,
    last_synced_at      TEXT,
    hash                TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_source_project ON token_source(project_root);
CREATE INDEX IF NOT EXISTS idx_token_source_name    ON token_source(token_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_source_project_name ON token_source(project_root, token_name);

CREATE TABLE IF NOT EXISTS sync_history (
    id                  TEXT    PRIMARY KEY,
    project_root        TEXT    NOT NULL,
    sync_type           TEXT    NOT NULL CHECK (sync_type IN ('pull', 'push', 'auto')),
    started_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at        TEXT,
    status              TEXT    NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    tokens_added        INTEGER NOT NULL DEFAULT 0,
    tokens_modified     INTEGER NOT NULL DEFAULT 0,
    tokens_removed      INTEGER NOT NULL DEFAULT 0,
    conflicts_detected  INTEGER NOT NULL DEFAULT 0,
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_history_project ON sync_history(project_root);
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at);

CREATE TABLE IF NOT EXISTS pending_conflicts (
    id                  TEXT    PRIMARY KEY,
    project_root        TEXT    NOT NULL,
    token_name          TEXT    NOT NULL,
    local_value         TEXT    NOT NULL,
    remote_value        TEXT    NOT NULL,
    figma_variable_id   TEXT,
    detected_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at         TEXT,
    resolution          TEXT    CHECK (resolution IS NULL OR resolution IN ('local', 'remote', 'merged')),
    merged_value        TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_conflicts_project ON pending_conflicts(project_root);
CREATE INDEX IF NOT EXISTS idx_pending_conflicts_unresolved ON pending_conflicts(project_root, resolved_at);
`

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SyncSchema {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(INIT_SQL)
    }

    /** Return the underlying database handle (for other services sharing this DB). */
    getDb(): Database.Database {
        return this.db
    }

    /** Verify all four tables exist. Returns table names found. */
    verifyTables(): string[] {
        const rows = this.db
            .prepare(
                `SELECT name FROM sqlite_master
                 WHERE type = 'table'
                   AND name IN ('figma_connections', 'token_source', 'sync_history', 'pending_conflicts')
                 ORDER BY name`
            )
            .all() as Array<{ name: string }>
        return rows.map((r) => r.name)
    }
}
