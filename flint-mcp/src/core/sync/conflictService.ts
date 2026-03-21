/**
 * SYNC.2 — Conflict Service.
 *
 * Manages the pending_conflicts table for three-way diff conflicts.
 */

import type Database from 'better-sqlite3'
import crypto from 'node:crypto'
import type { PendingConflict, ConflictResolution } from './types.js'

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface ConflictRow {
    id: string
    project_root: string
    token_name: string
    local_value: string
    remote_value: string
    figma_variable_id: string | null
    detected_at: string
    resolved_at: string | null
    resolution: string | null
}

function rowToConflict(row: ConflictRow): PendingConflict {
    return {
        id: row.id,
        projectRoot: row.project_root,
        tokenName: row.token_name,
        localValue: row.local_value,
        remoteValue: row.remote_value,
        figmaVariableId: row.figma_variable_id,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at,
        resolution: (row.resolution as ConflictResolution) ?? null,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface CreateConflictInput {
    projectRoot: string
    tokenName: string
    localValue: string
    remoteValue: string
    figmaVariableId?: string | null
}

export class ConflictService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
    }

    /** Create a new pending conflict. */
    createConflict(input: CreateConflictInput): PendingConflict {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        this.db
            .prepare(
                `INSERT INTO pending_conflicts (id, project_root, token_name, local_value, remote_value, figma_variable_id, detected_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(id, input.projectRoot, input.tokenName, input.localValue, input.remoteValue, input.figmaVariableId ?? null, now)

        return {
            id,
            projectRoot: input.projectRoot,
            tokenName: input.tokenName,
            localValue: input.localValue,
            remoteValue: input.remoteValue,
            figmaVariableId: input.figmaVariableId ?? null,
            detectedAt: now,
            resolvedAt: null,
            resolution: null,
        }
    }

    /** Get all unresolved conflicts for a project. */
    getConflicts(projectRoot: string): PendingConflict[] {
        const rows = this.db
            .prepare('SELECT * FROM pending_conflicts WHERE project_root = ? AND resolved_at IS NULL ORDER BY detected_at DESC')
            .all(projectRoot) as ConflictRow[]
        return rows.map(rowToConflict)
    }

    /** Get a conflict by ID. */
    getById(id: string): PendingConflict | null {
        const row = this.db
            .prepare('SELECT * FROM pending_conflicts WHERE id = ?')
            .get(id) as ConflictRow | undefined
        return row ? rowToConflict(row) : null
    }

    /** Resolve a single conflict. */
    resolveConflict(id: string, resolution: 'local' | 'remote' | 'merged', mergedValue?: string): PendingConflict | null {
        const now = new Date().toISOString()
        this.db
            .prepare('UPDATE pending_conflicts SET resolved_at = ?, resolution = ?, merged_value = ? WHERE id = ? AND resolved_at IS NULL')
            .run(now, resolution, mergedValue ?? null, id)

        return this.getById(id)
    }

    /** Bulk resolve all unresolved conflicts for a project. Returns count resolved. */
    resolveAll(projectRoot: string, resolution: 'local' | 'remote'): number {
        const now = new Date().toISOString()
        const result = this.db
            .prepare('UPDATE pending_conflicts SET resolved_at = ?, resolution = ? WHERE project_root = ? AND resolved_at IS NULL')
            .run(now, resolution, projectRoot)
        return result.changes
    }
}
