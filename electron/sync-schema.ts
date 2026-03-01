/**
 * Sync Schema — electron/sync-schema.ts
 *
 * PowerSync bucket definitions for the Bridge IDE multiplayer layer.
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

/**
 * The complete SyncRules schema object passed to the PowerSyncDatabase
 * initializer when a backend URL is configured.
 *
 * Usage (once @powersync/node is connected to a backend):
 * ```ts
 * import { SYNC_SCHEMA } from './sync-schema.js'
 * const db = new PowerSyncDatabase({ schema: SYNC_SCHEMA, ... })
 * ```
 */
export const SYNC_SCHEMA = {
    buckets: {
        global_tokens: globalTokensBucket,
        project_metadata: projectMetadataBucket,
        ephemeral_presence: ephemeralPresenceBucket,
    },
} as const
