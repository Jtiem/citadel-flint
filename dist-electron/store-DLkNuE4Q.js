import _ from "better-sqlite3";
import r from "node:path";
import { app as L } from "electron";
import { Worker as c } from "node:worker_threads";
import { Schema as N, Table as n, column as e, PowerSyncDatabase as l } from "@powersync/node";
const m = new N({
  design_tokens: new n({
    token_path: e.text,
    token_type: e.text,
    token_value: e.text,
    description: e.text,
    mode: e.text,
    collection_name: e.text,
    version: e.text,
    last_modified: e.integer,
    created_at: e.integer,
    updated_at: e.integer
  }),
  project_state: new n({
    key: e.text,
    value: e.text,
    updated_at: e.integer
  }),
  presence: new n({
    user_id: e.text,
    node_id: e.text,
    x: e.real,
    y: e.real,
    updated_at: e.integer
  })
}), a = r.join(L.getPath("userData"), "bridge.db"), t = new _(a);
t.pragma("journal_mode = WAL");
t.exec(`
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
const T = t.prepare("PRAGMA table_info(design_tokens)").all();
T.length === 0 ? (t.exec(`
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
    `), console.log("[Bridge] design_tokens table created (v2 schema)")) : T.some((o) => o.name === "mode") ? console.log("[Bridge] design_tokens schema current (v2)") : (console.log("[Bridge] Migrating design_tokens v1 → v2…"), t.exec(`
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
const d = t.prepare("PRAGMA table_info(design_tokens)").all();
d.some((o) => o.name === "version") || (t.exec("ALTER TABLE design_tokens ADD COLUMN version TEXT"), console.log("[Bridge] design_tokens: added column version (v3 migration)"));
d.some((o) => o.name === "last_modified") || (t.exec("ALTER TABLE design_tokens ADD COLUMN last_modified INTEGER"), console.log("[Bridge] design_tokens: added column last_modified (v3 migration)"));
t.exec(`
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
const s = t.prepare("PRAGMA table_info(component_overrides)").all(), i = `
    CREATE TABLE component_overrides (
        bridge_id      TEXT    NOT NULL,
        property_key   TEXT    NOT NULL,
        property_value TEXT    NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (bridge_id, property_key)
    )
`;
s.length === 0 ? (t.exec(i), console.log("[Bridge] component_overrides table created (v2 schema)")) : s.some((o) => o.name === "property_key") ? console.log("[Bridge] component_overrides schema current (v2)") : (t.exec("DROP TABLE component_overrides;" + i), console.log("[Bridge] component_overrides migrated to v2 schema"));
console.log(`[Bridge] Database ready at: ${a}`);
const p = new l({
  schema: m,
  database: {
    dbFilename: a,
    openWorker: (o, E) => new c(r.join(__dirname, "powersync.worker.js"), E)
  }
});
p.init().catch((o) => {
  console.error("[Bridge] PowerSync init failed:", o);
});
export {
  t as default,
  p as powerSyncDb
};
