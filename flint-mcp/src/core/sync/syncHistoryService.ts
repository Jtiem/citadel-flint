/**
 * SYNC.2 — Sync History Service.
 *
 * Records sync operations in the sync_history table.
 */

import type Database from 'better-sqlite3'
import crypto from 'node:crypto'
import type { SyncHistoryEntry, SyncType, SyncStatus } from './types.js'

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface SyncHistoryRow {
    id: string
    project_root: string
    sync_type: string
    started_at: string
    completed_at: string | null
    status: string
    tokens_added: number
    tokens_modified: number
    tokens_removed: number
    conflicts_detected: number
    error_message: string | null
}

function rowToEntry(row: SyncHistoryRow): SyncHistoryEntry {
    return {
        id: row.id,
        projectRoot: row.project_root,
        syncType: row.sync_type as SyncType,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        status: row.status as SyncStatus,
        tokensAdded: row.tokens_added,
        tokensModified: row.tokens_modified,
        tokensRemoved: row.tokens_removed,
        conflictsDetected: row.conflicts_detected,
        errorMessage: row.error_message,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface RecordSyncInput {
    projectRoot: string
    syncType: SyncType
    status: SyncStatus
    tokensAdded: number
    tokensModified: number
    tokensRemoved: number
    conflictsDetected: number
    errorMessage?: string | null
}

export class SyncHistoryService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
    }

    /** Record a completed sync operation. */
    recordSync(entry: RecordSyncInput): SyncHistoryEntry {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        this.db
            .prepare(
                `INSERT INTO sync_history (id, project_root, sync_type, started_at, completed_at, status, tokens_added, tokens_modified, tokens_removed, conflicts_detected, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                id,
                entry.projectRoot,
                entry.syncType,
                now,
                now,
                entry.status,
                entry.tokensAdded,
                entry.tokensModified,
                entry.tokensRemoved,
                entry.conflictsDetected,
                entry.errorMessage ?? null,
            )

        return {
            id,
            projectRoot: entry.projectRoot,
            syncType: entry.syncType,
            startedAt: now,
            completedAt: now,
            status: entry.status,
            tokensAdded: entry.tokensAdded,
            tokensModified: entry.tokensModified,
            tokensRemoved: entry.tokensRemoved,
            conflictsDetected: entry.conflictsDetected,
            errorMessage: entry.errorMessage ?? null,
        }
    }

    /** Get sync history for a project, most recent first. */
    getHistory(projectRoot: string, limit = 50): SyncHistoryEntry[] {
        const rows = this.db
            .prepare('SELECT * FROM sync_history WHERE project_root = ? ORDER BY started_at DESC LIMIT ?')
            .all(projectRoot, limit) as SyncHistoryRow[]
        return rows.map(rowToEntry)
    }

    /** Get the most recent sync entry for a project. */
    getLastSync(projectRoot: string): SyncHistoryEntry | null {
        const row = this.db
            .prepare('SELECT * FROM sync_history WHERE project_root = ? ORDER BY started_at DESC LIMIT 1')
            .get(projectRoot) as SyncHistoryRow | undefined
        return row ? rowToEntry(row) : null
    }

    /** Export sync history as JSON or CSV. */
    exportHistory(projectRoot: string, format: 'json' | 'csv'): string {
        const entries = this.getHistory(projectRoot, 1000)

        if (format === 'json') {
            return JSON.stringify(entries, null, 2)
        }

        // CSV
        const headers = [
            'id', 'projectRoot', 'syncType', 'startedAt', 'completedAt',
            'status', 'tokensAdded', 'tokensModified', 'tokensRemoved',
            'conflictsDetected', 'errorMessage',
        ]
        const lines = [headers.join(',')]
        for (const e of entries) {
            lines.push([
                csvEscape(e.id),
                csvEscape(e.projectRoot),
                csvEscape(e.syncType),
                csvEscape(e.startedAt),
                csvEscape(e.completedAt ?? ''),
                csvEscape(e.status),
                String(e.tokensAdded),
                String(e.tokensModified),
                String(e.tokensRemoved),
                String(e.conflictsDetected),
                csvEscape(e.errorMessage ?? ''),
            ].join(','))
        }
        return lines.join('\n')
    }
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}
