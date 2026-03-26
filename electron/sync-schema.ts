/**
 * Sync Schema — electron/sync-schema.ts
 *
 * PowerSync bucket definitions for the Flint Glass multiplayer layer.
 *
 * Three buckets partition shared data:
 *   global_tokens      — all design tokens; visible to every collaborator
 *   project_metadata   — per-repository canvas state and settings
 *   ephemeral_presence — volatile cursor/selection records (not durably synced)
 *
 * This schema is the source of truth for SyncRules configuration once a
 * PowerSync backend URL is provisioned. In the interim, the local SQLite
 * tables (managed by store.ts) serve the same data without network sync.
 *
 * Reference: https://docs.powersync.com/usage/sync-rules
 *
 * Main Process only — no browser imports.
 */

// ── Bucket descriptor type ────────────────────────────────────────────────────

/**
 * Describes a single PowerSync sync-rules bucket.
 * Maps to one SQLite table on the client; the `select` statement is evaluated
 * server-side to determine which rows are synced into this bucket.
 */
export interface BucketDescriptor {
    /** Client-side SQLite table that receives the synced rows. */
    table: string
    /** Server-side SELECT that identifies rows belonging to this bucket. */
    select: string
    /**
     * Optional cap on the number of rows per bucket partition.
     * Useful for ephemeral data (presence) where unbounded growth is unwanted.
     */
    maxRows?: number
}

// ── Bucket definitions ────────────────────────────────────────────────────────

/**
 * Global tokens bucket — the canonical set of design tokens.
 * All collaborators receive the full table; no per-user partition is applied.
 * Includes `version` and `last_modified` for optimistic conflict resolution.
 */
export const globalTokensBucket: BucketDescriptor = {
    table: 'design_tokens',
    select: `
        SELECT
            id,
            token_path,
            token_type,
            token_value,
            description,
            mode,
            collection_name,
            version,
            last_modified,
            created_at,
            updated_at
        FROM design_tokens
    `,
}

/**
 * Project metadata bucket — canvas layout and app-level settings.
 * Partitioned per project; teams only sync rows scoped to their repository.
 * Powered by the `project_state` key-value table.
 */
export const projectMetadataBucket: BucketDescriptor = {
    table: 'project_state',
    select: `
        SELECT key, value, updated_at
        FROM project_state
    `,
}

/**
 * Ephemeral presence bucket — volatile cursor and selection records.
 * Capped at 50 rows; rows are evicted server-side after a short TTL.
 * Data loss on disconnect is intentional and acceptable.
 */
export const ephemeralPresenceBucket: BucketDescriptor = {
    table: 'presence',
    select: `
        SELECT
            id,
            user_id,
            node_id,
            x,
            y,
            updated_at
        FROM presence
    `,
    maxRows: 50,
}

// ── Composite schema ──────────────────────────────────────────────────────────

import { Schema, Table, column } from '@powersync/node'

/**
 * The complete SyncRules schema object passed to the PowerSyncDatabase
 * initializer when a backend URL is configured.
 */
export const SYNC_SCHEMA = new Schema({
    design_tokens: new Table({
        token_path: column.text,
        token_type: column.text,
        token_value: column.text,
        description: column.text,
        mode: column.text,
        collection_name: column.text,
        version: column.text,
        last_modified: column.integer,
        created_at: column.integer,
        updated_at: column.integer,
    }),
    project_state: new Table({
        key: column.text,
        value: column.text,
        updated_at: column.integer,
    }),
    presence: new Table({
        user_id: column.text,
        node_id: column.text,
        x: column.real,
        y: column.real,
        updated_at: column.integer,
    })
})
