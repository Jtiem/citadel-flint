/**
 * Data Core — electron/store.ts
 *
 * Initializes the better-sqlite3 database in the user's app data directory
 * (never a hardcoded local path) and creates the three core tables.
 *
 * This module is imported by main.ts and ingestion-server.ts only.
 * It MUST NOT be imported anywhere inside src/.
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import * as sqliteVec from 'sqlite-vec'
import { BRAND } from '../shared/brand.ts'

// Resolve to the OS-appropriate user data directory:
//   macOS: ~/Library/Application Support/flint-ide/flint.db
//   Windows: %APPDATA%\flint-ide\flint.db
//   Linux: ~/.config/flint-ide/flint.db
const DB_PATH = path.join(app.getPath('userData'), 'flint.db')

const db = new Database(DB_PATH)

// WAL mode dramatically improves write performance for concurrent reads
db.pragma('journal_mode = WAL')

// ── Phase M: Load sqlite-vec extension for vector search ──────────────────────
// In packaged builds, import.meta.url resolves to a virtual ASAR path, breaking
// sqlite-vec's getLoadablePath(). Bypass it by computing the unpacked path directly.
function getSqliteVecPath(): string {
    if (!app.isPackaged) return sqliteVec.getLoadablePath()
    const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux'
    const ext = process.platform === 'darwin' ? 'dylib' : process.platform === 'win32' ? 'dll' : 'so'
    return path.join(
        process.resourcesPath, 'app.asar.unpacked', 'node_modules',
        `sqlite-vec-${platform}-${process.arch}`, `vec0.${ext}`
    )
}
db.loadExtension(getSqliteVecPath())
console.log(`${BRAND.logPrefix} sqlite-vec extension loaded`)

// ── Static tables (schema is stable, CREATE IF NOT EXISTS is safe) ─────────────

db.exec(`
    -- Stores arbitrary serialised app state (canvas layout, settings, etc.)
    CREATE TABLE IF NOT EXISTS project_state (
        key         TEXT    PRIMARY KEY,
        value       TEXT    NOT NULL,
        updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Caches raw Figma asset images as Base64 strings
    CREATE TABLE IF NOT EXISTS assets_cache (
        id          TEXT    PRIMARY KEY,
        base64_data TEXT    NOT NULL,
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Maps Figma node IDs to their generated React component source
    CREATE TABLE IF NOT EXISTS component_mappings (
        id               TEXT    PRIMARY KEY,
        figma_node_id    TEXT    NOT NULL,
        react_component  TEXT    NOT NULL,
        created_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
`)

// ── design_tokens: versioned migration ────────────────────────────────────────
//
// v1 schema: UNIQUE(token_path) — single value per path
// v2 schema: UNIQUE(token_path, mode, collection_name) — multi-mode support
//            for Light/Dark theming and per-collection namespacing
//
// Strategy: inspect the live table columns via PRAGMA rather than tracking
// a user_version, so the migration is idempotent across cold starts.

const tokenColumns = db
    .prepare('PRAGMA table_info(design_tokens)')
    .all() as Array<{ name: string }>

if (tokenColumns.length === 0) {
    // ── Brand-new database: create v2 table directly ──────────────────────────
    db.exec(`
        CREATE TABLE design_tokens (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            token_path      TEXT    NOT NULL,
            token_type      TEXT    NOT NULL,
            token_value     TEXT    NOT NULL,
            description     TEXT,
            mode            TEXT    NOT NULL DEFAULT 'default',
            collection_name TEXT    NOT NULL DEFAULT 'default',
            created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(token_path, mode, collection_name)
        )
    `)
    console.log(`${BRAND.logPrefix} design_tokens table created (v2 schema)`)

} else if (!tokenColumns.some((col) => col.name === 'mode')) {
    // ── v1 table detected: migrate to v2, preserving existing rows ───────────
    // Existing rows receive mode='default' and collection_name='default'.
    // DROP TABLE IF EXISTS design_tokens_v2 cleans up any previous partial run.
    console.log(`${BRAND.logPrefix} Migrating design_tokens v1 → v2…`)
    db.exec(`
        DROP TABLE IF EXISTS design_tokens_v2;

        CREATE TABLE design_tokens_v2 (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            token_path      TEXT    NOT NULL,
            token_type      TEXT    NOT NULL,
            token_value     TEXT    NOT NULL,
            description     TEXT,
            mode            TEXT    NOT NULL DEFAULT 'default',
            collection_name TEXT    NOT NULL DEFAULT 'default',
            created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(token_path, mode, collection_name)
        );

        INSERT OR IGNORE INTO design_tokens_v2
            (id, token_path, token_type, token_value, description, created_at, updated_at)
            SELECT id, token_path, token_type, token_value, description, created_at, updated_at
            FROM design_tokens;

        DROP TABLE IF EXISTS design_tokens;

        ALTER TABLE design_tokens_v2 RENAME TO design_tokens;
    `)
    console.log(`${BRAND.logPrefix} design_tokens migrated to v2 schema`)

} else {
    // ── v2 schema already present: nothing to do ─────────────────────────────
    console.log(`${BRAND.logPrefix} design_tokens schema current (v2)`)
}

// ── design_tokens v3 migration: add version + last_modified ───────────────────
//
// v3 adds two columns for PowerSync conflict resolution:
//   version       — opaque string set by the server (e.g. a UUID or vector clock)
//   last_modified — Unix epoch seconds of the last remote write
//
// Both are nullable so existing rows survive the ALTER TABLE without data loss.
// Migration is idempotent: check PRAGMA before altering.
const tokenColumnsV3 = db
    .prepare('PRAGMA table_info(design_tokens)')
    .all() as Array<{ name: string }>

if (!tokenColumnsV3.some((col) => col.name === 'version')) {
    db.exec('ALTER TABLE design_tokens ADD COLUMN version TEXT')
    console.log(`${BRAND.logPrefix} design_tokens: added column version (v3 migration)`)
}
if (!tokenColumnsV3.some((col) => col.name === 'last_modified')) {
    db.exec('ALTER TABLE design_tokens ADD COLUMN last_modified INTEGER')
    console.log(`${BRAND.logPrefix} design_tokens: added column last_modified (v3 migration)`)
}

// ── presence table ────────────────────────────────────────────────────────────
//
// Tracks the last-known cursor position and selected node for each user session.
// `id` is a session UUID — unique per collaborator, used as the UPSERT key.
// Data is ephemeral: a short-TTL PowerSync bucket evicts stale rows server-side.
db.exec(`
    CREATE TABLE IF NOT EXISTS presence (
        id         TEXT    PRIMARY KEY,
        user_id    TEXT    NOT NULL,
        node_id    TEXT    NOT NULL DEFAULT '',
        x          REAL    NOT NULL DEFAULT 0,
        y          REAL    NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
`)
console.log(`${BRAND.logPrefix} presence table ready`)

// ── component_overrides table ─────────────────────────────────────────────────
//
// Tracks export locks for individual JSX element properties. Each row records
// a single overridden property (e.g. style, textContent) on an element.
//
// v1 schema: PRIMARY KEY (flint_id)                — one row per element
// v2 schema: PRIMARY KEY (flint_id, property_key)  — one row per property
//
// v1 → v2 migration: the table is ephemeral (rows are re-created on the next
// edit), so it is safe to DROP and recreate without data migration.

const overrideColumns = db
    .prepare('PRAGMA table_info(component_overrides)')
    .all() as Array<{ name: string }>

const OVERRIDE_DDL = `
    CREATE TABLE component_overrides (
        flint_id      TEXT    NOT NULL,
        property_key   TEXT    NOT NULL,
        property_value TEXT    NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (flint_id, property_key)
    )
`

if (overrideColumns.length === 0) {
    // Fresh database — create v2 directly.
    db.exec(OVERRIDE_DDL)
    console.log(`${BRAND.logPrefix} component_overrides table created (v2 schema)`)
} else if (!overrideColumns.some((col) => col.name === 'property_key')) {
    // v1 detected — drop and recreate (data is ephemeral, no migration needed).
    db.exec('DROP TABLE component_overrides;' + OVERRIDE_DDL)
    console.log(`${BRAND.logPrefix} component_overrides migrated to v2 schema`)
} else {
    console.log(`${BRAND.logPrefix} component_overrides schema current (v2)`)
}

// ── Phase M: Design System RAG vector table ──────────────────────────────────
//
// Stores text chunk embeddings for semantic search over design system docs,
// component patterns, and usage guidelines. Embeddings are 384-dimensional
// float32 vectors (matches all-MiniLM-L6-v2 / text-embedding-3-small output
// when configured with dimensions=384).
//
// vec_design_system is a sqlite-vec virtual table; the companion metadata table
// stores the source text chunks and provenance info.

db.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        content     TEXT    NOT NULL,
        source      TEXT    NOT NULL DEFAULT '',
        chunk_type  TEXT    NOT NULL DEFAULT 'documentation',
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
`)

// sqlite-vec virtual table — 384-dim float32 vectors
db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_design_system USING vec0(
        chunk_id INTEGER PRIMARY KEY,
        embedding float[384]
    )
`)

console.log(`${BRAND.logPrefix} RAG vector tables ready`)

// ── Delta Mode: violation_baselines table ─────────────────────────────────────
//
// Stores the set of violations that were present when the user clicked
// "Set Baseline". Flint uses this to compute a delta — only violations
// that did NOT exist at baseline time are surfaced. Teams adopting Flint
// on existing codebases can suppress known pre-existing issues and focus
// exclusively on new regressions.
//
// Composite UNIQUE(file_path, node_id, rule_id) ensures idempotent upserts:
// re-running baseline:set on the same file just refreshes snapshot_value.
db.exec(`
    CREATE TABLE IF NOT EXISTS violation_baselines (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path      TEXT    NOT NULL,
        node_id        TEXT    NOT NULL,
        rule_id        TEXT    NOT NULL,
        severity       TEXT    NOT NULL,
        snapshot_value TEXT,
        created_at     INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(file_path, node_id, rule_id)
    )
`)
console.log(`${BRAND.logPrefix} violation_baselines table ready`)

console.log(`${BRAND.logPrefix} Database ready at: ${DB_PATH}`)

// ── PowerSync Integration ──────────────────────────────────────────────────────
// We instantiate the PowerSync abstraction pointing to the exact same database
// file. better-sqlite3 handles concurrent local writes via WAL mode perfectly,
// while PowerSync intercepts those writes via SQLite triggers to build its sync queue.

// export const powerSyncDb = new PowerSyncDatabase({
//     schema: SYNC_SCHEMA,
//     database: {
//         dbFilename: DB_PATH,
//         openWorker: (_, options) => {
//             return new Worker(path.join(import.meta.dirname, 'powersync.worker.js'), options as unknown as any)
//         }
//     }
// })

// Background initialization
// powerSyncDb.init().catch(err => {
//     console.error('[Flint] PowerSync init failed:', err)
// })

export default db
