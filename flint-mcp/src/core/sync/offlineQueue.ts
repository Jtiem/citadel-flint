/**
 * SYNC.4 — Offline Queue with Retry.
 *
 * When Figma API is unreachable, queues sync operations for later retry
 * with exponential backoff.
 */

import type Database from 'better-sqlite3'
import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueOperationType = 'pull' | 'push'
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface QueueItem {
    id: string
    projectRoot: string
    operationType: QueueOperationType
    argsJson: string
    createdAt: string
    retryCount: number
    lastError: string | null
    status: QueueItemStatus
}

interface QueueRow {
    id: string
    project_root: string
    operation_type: string
    args_json: string
    created_at: string
    retry_count: number
    last_error: string | null
    status: string
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const QUEUE_DDL = `
CREATE TABLE IF NOT EXISTS sync_queue (
    id              TEXT    PRIMARY KEY,
    project_root    TEXT    NOT NULL,
    operation_type  TEXT    NOT NULL CHECK (operation_type IN ('pull', 'push')),
    args_json       TEXT    NOT NULL DEFAULT '{}',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_project ON sync_queue(project_root);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status  ON sync_queue(status);
`

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** Maximum retries before marking as failed. */
const MAX_RETRIES = 5

/** Base delay in ms for exponential backoff (used in processQueue). */
const BASE_DELAY_MS = 1000

function rowToItem(row: QueueRow): QueueItem {
    return {
        id: row.id,
        projectRoot: row.project_root,
        operationType: row.operation_type as QueueOperationType,
        argsJson: row.args_json,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastError: row.last_error,
        status: row.status as QueueItemStatus,
    }
}

export class OfflineQueue {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(QUEUE_DDL)
    }

    /** Enqueue a sync operation for later retry. */
    enqueue(projectRoot: string, operationType: QueueOperationType, args: Record<string, unknown> = {}): QueueItem {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const argsJson = JSON.stringify(args)

        this.db
            .prepare(
                `INSERT INTO sync_queue (id, project_root, operation_type, args_json, created_at, retry_count, last_error, status)
                 VALUES (?, ?, ?, ?, ?, 0, NULL, 'pending')`,
            )
            .run(id, projectRoot, operationType, argsJson, now)

        return {
            id,
            projectRoot,
            operationType,
            argsJson,
            createdAt: now,
            retryCount: 0,
            lastError: null,
            status: 'pending',
        }
    }

    /** Get count of pending operations for a project. */
    getQueueSize(projectRoot: string): number {
        const row = this.db
            .prepare("SELECT COUNT(*) as cnt FROM sync_queue WHERE project_root = ? AND status IN ('pending', 'processing')")
            .get(projectRoot) as { cnt: number }
        return row.cnt
    }

    /** Get all pending items for a project. */
    getPendingItems(projectRoot: string): QueueItem[] {
        const rows = this.db
            .prepare("SELECT * FROM sync_queue WHERE project_root = ? AND status = 'pending' ORDER BY created_at ASC")
            .all(projectRoot) as QueueRow[]
        return rows.map(rowToItem)
    }

    /**
     * Process the queue: attempt each pending item with the provided executor.
     * Returns the number of successfully processed items.
     *
     * The executor receives (operationType, args) and should throw on failure.
     */
    async processQueue(
        projectRoot: string,
        executor: (operationType: QueueOperationType, args: Record<string, unknown>) => Promise<void>,
    ): Promise<{ processed: number; failed: number }> {
        const items = this.getPendingItems(projectRoot)
        let processed = 0
        let failed = 0

        for (const item of items) {
            // Mark as processing
            this.db
                .prepare("UPDATE sync_queue SET status = 'processing' WHERE id = ?")
                .run(item.id)

            try {
                const args = JSON.parse(item.argsJson)
                await executor(item.operationType, args)

                // Success
                this.db
                    .prepare("UPDATE sync_queue SET status = 'completed' WHERE id = ?")
                    .run(item.id)
                processed++
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : String(err)
                const newRetryCount = item.retryCount + 1

                if (newRetryCount >= MAX_RETRIES) {
                    this.db
                        .prepare("UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?")
                        .run(newRetryCount, errorMsg, item.id)
                    failed++
                } else {
                    this.db
                        .prepare("UPDATE sync_queue SET status = 'pending', retry_count = ?, last_error = ? WHERE id = ?")
                        .run(newRetryCount, errorMsg, item.id)
                }
            }
        }

        return { processed, failed }
    }

    /** Get the exponential backoff delay for a given retry count. */
    static getBackoffDelay(retryCount: number): number {
        return BASE_DELAY_MS * Math.pow(2, retryCount)
    }

    /** Clear completed items older than the given age in milliseconds. */
    pruneCompleted(maxAgeMs: number): number {
        const cutoff = new Date(Date.now() - maxAgeMs).toISOString()
        const result = this.db
            .prepare("DELETE FROM sync_queue WHERE status = 'completed' AND created_at < ?")
            .run(cutoff)
        return result.changes
    }
}
