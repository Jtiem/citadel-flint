import E from "better-sqlite3";
import i from "node:path";
import { app as d } from "electron";
const s = i.join(d.getPath("userData"), "bridge.db"), e = new E(s);
e.pragma("journal_mode = WAL");
e.exec(`
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
`);
const o = e.prepare("PRAGMA table_info(design_tokens)").all();
o.length === 0 ? (e.exec(`
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
    `), console.log("[Bridge] design_tokens table created (v2 schema)")) : o.some((t) => t.name === "mode") ? console.log("[Bridge] design_tokens schema current (v2)") : (console.log("[Bridge] Migrating design_tokens v1 → v2…"), e.exec(`
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
    `), console.log("[Bridge] design_tokens migrated to v2 schema"));
const a = e.prepare("PRAGMA table_info(design_tokens)").all();
a.some((t) => t.name === "version") || (e.exec("ALTER TABLE design_tokens ADD COLUMN version TEXT"), console.log("[Bridge] design_tokens: added column version (v3 migration)"));
a.some((t) => t.name === "last_modified") || (e.exec("ALTER TABLE design_tokens ADD COLUMN last_modified INTEGER"), console.log("[Bridge] design_tokens: added column last_modified (v3 migration)"));
e.exec(`
    CREATE TABLE IF NOT EXISTS presence (
        id         TEXT    PRIMARY KEY,
        user_id    TEXT    NOT NULL,
        node_id    TEXT    NOT NULL DEFAULT '',
        x          REAL    NOT NULL DEFAULT 0,
        y          REAL    NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
`);
console.log("[Bridge] presence table ready");
const T = e.prepare("PRAGMA table_info(component_overrides)").all(), n = `
    CREATE TABLE component_overrides (
        bridge_id      TEXT    NOT NULL,
        property_key   TEXT    NOT NULL,
        property_value TEXT    NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (bridge_id, property_key)
    )
`;
T.length === 0 ? (e.exec(n), console.log("[Bridge] component_overrides table created (v2 schema)")) : T.some((t) => t.name === "property_key") ? console.log("[Bridge] component_overrides schema current (v2)") : (e.exec("DROP TABLE component_overrides;" + n), console.log("[Bridge] component_overrides migrated to v2 schema"));
console.log(`[Bridge] Database ready at: ${s}`);
export {
  e as default
};
