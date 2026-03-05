/**
 * Sync Schema — src/core/sync/schema.ts
 *
 * Renderer-side type definitions for the Bridge IDE sync layer.
 *
 * This is the renderer-process mirror of `electron/sync-schema.ts`.
 * No cross-boundary imports are allowed (two-tsconfig architecture),
 * so the bucket descriptors are duplicated here as pure type declarations.
 *
 * Three partitions:
 *   global_tokens      — canonical design token set (read/write)
 *   project_metadata   — per-repository canvas state (read/write)
 *   ephemeral_presence — volatile cursor/selection records (ephemeral)
 *
 * When a PowerSync backend URL is provisioned, `SYNC_BUCKETS` maps
 * directly to the SyncRules configuration in `electron/sync-schema.ts`.
 * Until then, the local SQLite tables (managed by `electron/store.ts`)
 * serve the same data without network sync (Commandment 4 — Local-First).
 *
 * Renderer Process only — no Node.js imports.
 */

// ── Partition names ───────────────────────────────────────────────────────────

/**
 * The three SQLite tables managed by the Bridge sync layer.
 * Must match the `table` field of each `BucketDescriptor` in
 * `electron/sync-schema.ts`.
 */
export type SyncTable = 'design_tokens' | 'presence' | 'project_state'

// ── Bucket descriptor ─────────────────────────────────────────────────────────

/**
 * Renderer-side mirror of `BucketDescriptor` from `electron/sync-schema.ts`.
 *
 * Describes a single sync-rules bucket: which SQLite table it writes to
 * and which rows the server selects into it.
 */
export interface SyncBucket {
    /** Client-side SQLite table that receives the synced rows. */
    table: SyncTable
    /** Server-side SELECT statement that identifies rows belonging to this bucket. */
    select: string
    /**
     * Optional row cap per bucket partition.
     * Presence is capped at 50 to prevent unbounded growth.
     */
    maxRows?: number
}

// ── Bucket definitions ────────────────────────────────────────────────────────

/**
 * The complete set of sync buckets mirroring `electron/sync-schema.ts`.
 * Used for documentation, runtime introspection, and future PowerSync
 * schema validation in the renderer.
 */
export const SYNC_BUCKETS: Record<string, SyncBucket> = {
    /**
     * Global tokens — the canonical design token set.
     * All collaborators receive the full table; no per-user partition.
     * Includes `version` and `last_modified` for optimistic conflict resolution.
     */
    global_tokens: {
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
                last_modified
            FROM design_tokens
        `,
    },

    /**
     * Project metadata — canvas layout and app-level settings.
     * Partitioned per project when a backend is active.
     */
    project_metadata: {
        table: 'project_state',
        select: `
            SELECT key, value, updated_at
            FROM project_state
        `,
    },

    /**
     * Ephemeral presence — volatile cursor and selection records.
     * Capped at 50 rows; data loss on disconnect is intentional.
     */
    ephemeral_presence: {
        table: 'presence',
        select: `
            SELECT id, user_id, node_id, x, y, updated_at
            FROM presence
        `,
        maxRows: 50,
    },
} as const
