/**
 * Flint Project Registry — electron/registry.ts
 *
 * Manages `flint-registry.db` at `app.getPath('userData')` — a global,
 * workspace-independent SQLite database that tracks recently opened or
 * created Flint projects for the Launch Screen.
 *
 * Kept separate from the per-workspace `flint.db` (electron/store.ts) so
 * the registry survives workspace deletions and persists across sessions.
 *
 * Schema:
 *   recent_projects(id TEXT PK, name TEXT, path TEXT UNIQUE, last_opened INT)
 *
 * The UPSERT on `path` preserves the stable `id` UUID across repeated opens
 * while keeping `last_opened` current.
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

const REGISTRY_PATH = path.join(app.getPath('userData'), 'flint-registry.db')

const registryDb = new Database(REGISTRY_PATH)
registryDb.pragma('journal_mode = WAL')

registryDb.exec(`
    CREATE TABLE IF NOT EXISTS recent_projects (
        id          TEXT    PRIMARY KEY,
        name        TEXT    NOT NULL,
        path        TEXT    NOT NULL UNIQUE,
        last_opened INTEGER NOT NULL
    )
`)

console.log(`[Flint] Registry ready at: ${REGISTRY_PATH}`)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RecentProject {
    id: string
    name: string
    path: string
    last_opened: number
}

// ── Prepared statements (created once, reused across all IPC calls) ───────────

const stmtUpsert = registryDb.prepare<[string, string, string]>(`
    INSERT INTO recent_projects (id, name, path, last_opened)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(path) DO UPDATE SET
        name        = excluded.name,
        last_opened = strftime('%s', 'now')
`)

const stmtGetRecent = registryDb.prepare<[], RecentProject>(`
    SELECT id, name, path, last_opened
    FROM recent_projects
    ORDER BY last_opened DESC
    LIMIT 10
`)

const stmtRemove = registryDb.prepare<[string]>(
    'DELETE FROM recent_projects WHERE id = ?'
)

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new project or updates `last_opened` (and optionally `name`) for
 * an existing project with the same `path`. The stable `id` UUID is preserved
 * on conflict — it is set only on first insertion.
 *
 * @param id          — Caller-generated UUID (stable per project path).
 * @param name        — Human-readable project name (basename of the path).
 * @param projectPath — Absolute path to the project root directory.
 */
export function upsertProject(id: string, name: string, projectPath: string): void {
    stmtUpsert.run(id, name, projectPath)
}

/** Returns up to 10 recently opened projects, ordered newest-first. */
export function getRecentProjects(): RecentProject[] {
    return stmtGetRecent.all()
}

/**
 * Removes the project with the given `id` from the registry.
 * Silent no-op if the `id` does not exist.
 */
export function removeProject(id: string): void {
    stmtRemove.run(id)
}
