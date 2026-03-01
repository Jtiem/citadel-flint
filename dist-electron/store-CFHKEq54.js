import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";
const DB_PATH = path.join(app.getPath("userData"), "bridge.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
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

    -- W3C DTCG-aligned design tokens (Module F: Token Core)
    -- token_path uses dot-and-hyphen notation: "color-brand.primary", "spacing.medium"
    -- UNIQUE on token_path enforces one canonical entry per design decision.
    CREATE TABLE IF NOT EXISTS design_tokens (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        token_path   TEXT    NOT NULL UNIQUE,
        token_type   TEXT    NOT NULL,
        token_value  TEXT    NOT NULL,
        description  TEXT,
        created_at   INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at   INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
`);
console.log(`[Bridge] Database ready at: ${DB_PATH}`);
export {
  db as default
};
