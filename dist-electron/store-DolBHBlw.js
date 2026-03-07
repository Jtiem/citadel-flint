import Database from "better-sqlite3";
import path__default, { join } from "node:path";
import { app } from "electron";
import { Worker } from "node:worker_threads";
import { Schema, Table, column, PowerSyncDatabase } from "@powersync/node";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:process";
import { statSync } from "node:fs";
const SYNC_SCHEMA = new Schema({
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
    updated_at: column.integer
  }),
  project_state: new Table({
    key: column.text,
    value: column.text,
    updated_at: column.integer
  }),
  presence: new Table({
    user_id: column.text,
    node_id: column.text,
    x: column.real,
    y: column.real,
    updated_at: column.integer
  })
});
const BASE_PACKAGE_NAME = "sqlite-vec";
const ENTRYPOINT_BASE_NAME = "vec0";
const supportedPlatforms = [["macos", "aarch64"], ["linux", "aarch64"], ["windows", "x86_64"], ["linux", "x86_64"], ["macos", "x86_64"]];
const invalidPlatformErrorMessage = `Unsupported platform for ${BASE_PACKAGE_NAME}, on a ${platform}-${arch} machine. Supported platforms are (${supportedPlatforms.map(([p, a]) => `${p}-${a}`).join(",")}). Consult the ${BASE_PACKAGE_NAME} NPM package README for details.`;
const extensionNotFoundErrorMessage = (packageName) => `Loadble extension for ${BASE_PACKAGE_NAME} not found. Was the ${packageName} package installed?`;
function validPlatform(platform2, arch2) {
  return supportedPlatforms.find(([p, a]) => platform2 == p && arch2 === a) !== null;
}
function extensionSuffix(platform2) {
  if (platform2 === "win32") return "dll";
  if (platform2 === "darwin") return "dylib";
  return "so";
}
function platformPackageName(platform2, arch2) {
  const os = platform2 === "win32" ? "windows" : platform2;
  return `${BASE_PACKAGE_NAME}-${os}-${arch2}`;
}
function getLoadablePath() {
  if (!validPlatform(platform, arch)) {
    throw new Error(
      invalidPlatformErrorMessage
    );
  }
  const packageName = platformPackageName(platform, arch);
  const loadablePath = join(
    fileURLToPath(new URL(join("."), import.meta.url)),
    "..",
    packageName,
    `${ENTRYPOINT_BASE_NAME}.${extensionSuffix(platform)}`
  );
  if (!statSync(loadablePath, { throwIfNoEntry: false })) {
    throw new Error(extensionNotFoundErrorMessage(packageName));
  }
  return loadablePath;
}
const DB_PATH = path__default.join(app.getPath("userData"), "bridge.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.loadExtension(getLoadablePath());
console.log("[Bridge] sqlite-vec extension loaded");
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
`);
const tokenColumns = db.prepare("PRAGMA table_info(design_tokens)").all();
if (tokenColumns.length === 0) {
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
    `);
  console.log("[Bridge] design_tokens table created (v2 schema)");
} else if (!tokenColumns.some((col) => col.name === "mode")) {
  console.log("[Bridge] Migrating design_tokens v1 → v2…");
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
    `);
  console.log("[Bridge] design_tokens migrated to v2 schema");
} else {
  console.log("[Bridge] design_tokens schema current (v2)");
}
const tokenColumnsV3 = db.prepare("PRAGMA table_info(design_tokens)").all();
if (!tokenColumnsV3.some((col) => col.name === "version")) {
  db.exec("ALTER TABLE design_tokens ADD COLUMN version TEXT");
  console.log("[Bridge] design_tokens: added column version (v3 migration)");
}
if (!tokenColumnsV3.some((col) => col.name === "last_modified")) {
  db.exec("ALTER TABLE design_tokens ADD COLUMN last_modified INTEGER");
  console.log("[Bridge] design_tokens: added column last_modified (v3 migration)");
}
db.exec(`
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
const overrideColumns = db.prepare("PRAGMA table_info(component_overrides)").all();
const OVERRIDE_DDL = `
    CREATE TABLE component_overrides (
        bridge_id      TEXT    NOT NULL,
        property_key   TEXT    NOT NULL,
        property_value TEXT    NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (bridge_id, property_key)
    )
`;
if (overrideColumns.length === 0) {
  db.exec(OVERRIDE_DDL);
  console.log("[Bridge] component_overrides table created (v2 schema)");
} else if (!overrideColumns.some((col) => col.name === "property_key")) {
  db.exec("DROP TABLE component_overrides;" + OVERRIDE_DDL);
  console.log("[Bridge] component_overrides migrated to v2 schema");
} else {
  console.log("[Bridge] component_overrides schema current (v2)");
}
db.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        content     TEXT    NOT NULL,
        source      TEXT    NOT NULL DEFAULT '',
        chunk_type  TEXT    NOT NULL DEFAULT 'documentation',
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
`);
db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_design_system USING vec0(
        chunk_id INTEGER PRIMARY KEY,
        embedding float[384]
    )
`);
console.log("[Bridge] RAG vector tables ready");
console.log(`[Bridge] Database ready at: ${DB_PATH}`);
new PowerSyncDatabase({
  schema: SYNC_SCHEMA,
  database: {
    dbFilename: DB_PATH,
    openWorker: (_, options) => {
      return new Worker(path__default.join(import.meta.dirname, "powersync.worker.js"), options);
    }
  }
});
export {
  db as default
};
