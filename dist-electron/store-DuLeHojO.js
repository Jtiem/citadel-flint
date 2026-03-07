import g from "better-sqlite3";
import _, { join as E } from "node:path";
import { app as A } from "electron";
import { Worker as R } from "node:worker_threads";
import { Schema as U, Table as r, column as t, PowerSyncDatabase as u } from "@powersync/node";
import { fileURLToPath as f } from "node:url";
import { platform as a, arch as i } from "node:process";
import { statSync as O } from "node:fs";
const I = new U({
  design_tokens: new r({
    token_path: t.text,
    token_type: t.text,
    token_value: t.text,
    description: t.text,
    mode: t.text,
    collection_name: t.text,
    version: t.text,
    last_modified: t.integer,
    created_at: t.integer,
    updated_at: t.integer
  }),
  project_state: new r({
    key: t.text,
    value: t.text,
    updated_at: t.integer
  }),
  presence: new r({
    user_id: t.text,
    node_id: t.text,
    x: t.real,
    y: t.real,
    updated_at: t.integer
  })
}), s = "sqlite-vec", k = "vec0", N = [["macos", "aarch64"], ["linux", "aarch64"], ["windows", "x86_64"], ["linux", "x86_64"], ["macos", "x86_64"]], v = `Unsupported platform for ${s}, on a ${a}-${i} machine. Supported platforms are (${N.map(([e, n]) => `${e}-${n}`).join(",")}). Consult the ${s} NPM package README for details.`, h = (e) => `Loadble extension for ${s} not found. Was the ${e} package installed?`;
function D(e, n) {
  return N.find(([d, p]) => e == d && n === p) !== null;
}
function X(e) {
  return e === "win32" ? "dll" : e === "darwin" ? "dylib" : "so";
}
function w(e, n) {
  return `${s}-${e === "win32" ? "windows" : e}-${n}`;
}
function x() {
  if (!D(a, i))
    throw new Error(
      v
    );
  const e = w(a, i), n = E(
    f(new URL(E("."), import.meta.url)),
    "..",
    e,
    `${k}.${X(a)}`
  );
  if (!O(n, { throwIfNoEntry: !1 }))
    throw new Error(h(e));
  return n;
}
function B(e) {
  e.loadExtension(x());
}
const T = _.join(A.getPath("userData"), "bridge.db"), o = new g(T);
o.pragma("journal_mode = WAL");
B(o);
console.log("[Bridge] sqlite-vec extension loaded");
o.exec(`
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
const c = o.prepare("PRAGMA table_info(design_tokens)").all();
c.length === 0 ? (o.exec(`
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
    `), console.log("[Bridge] design_tokens table created (v2 schema)")) : c.some((e) => e.name === "mode") ? console.log("[Bridge] design_tokens schema current (v2)") : (console.log("[Bridge] Migrating design_tokens v1 → v2…"), o.exec(`
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
const m = o.prepare("PRAGMA table_info(design_tokens)").all();
m.some((e) => e.name === "version") || (o.exec("ALTER TABLE design_tokens ADD COLUMN version TEXT"), console.log("[Bridge] design_tokens: added column version (v3 migration)"));
m.some((e) => e.name === "last_modified") || (o.exec("ALTER TABLE design_tokens ADD COLUMN last_modified INTEGER"), console.log("[Bridge] design_tokens: added column last_modified (v3 migration)"));
o.exec(`
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
const l = o.prepare("PRAGMA table_info(component_overrides)").all(), L = `
    CREATE TABLE component_overrides (
        bridge_id      TEXT    NOT NULL,
        property_key   TEXT    NOT NULL,
        property_value TEXT    NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (bridge_id, property_key)
    )
`;
l.length === 0 ? (o.exec(L), console.log("[Bridge] component_overrides table created (v2 schema)")) : l.some((e) => e.name === "property_key") ? console.log("[Bridge] component_overrides schema current (v2)") : (o.exec("DROP TABLE component_overrides;" + L), console.log("[Bridge] component_overrides migrated to v2 schema"));
o.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        content     TEXT    NOT NULL,
        source      TEXT    NOT NULL DEFAULT '',
        chunk_type  TEXT    NOT NULL DEFAULT 'documentation',
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
`);
o.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_design_system USING vec0(
        chunk_id INTEGER PRIMARY KEY,
        embedding float[384]
    )
`);
console.log("[Bridge] RAG vector tables ready");
console.log(`[Bridge] Database ready at: ${T}`);
const F = new u({
  schema: I,
  database: {
    dbFilename: T,
    openWorker: (e, n) => new R(_.join(__dirname, "powersync.worker.js"), n)
  }
});
F.init().catch((e) => {
  console.error("[Bridge] PowerSync init failed:", e);
});
export {
  o as default,
  F as powerSyncDb
};
