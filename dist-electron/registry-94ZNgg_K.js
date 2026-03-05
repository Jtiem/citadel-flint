import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";
const REGISTRY_PATH = path.join(app.getPath("userData"), "bridge-registry.db");
const registryDb = new Database(REGISTRY_PATH);
registryDb.pragma("journal_mode = WAL");
registryDb.exec(`
    CREATE TABLE IF NOT EXISTS recent_projects (
        id          TEXT    PRIMARY KEY,
        name        TEXT    NOT NULL,
        path        TEXT    NOT NULL UNIQUE,
        last_opened INTEGER NOT NULL
    )
`);
console.log(`[Bridge] Registry ready at: ${REGISTRY_PATH}`);
const stmtUpsert = registryDb.prepare(`
    INSERT INTO recent_projects (id, name, path, last_opened)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(path) DO UPDATE SET
        name        = excluded.name,
        last_opened = strftime('%s', 'now')
`);
const stmtGetRecent = registryDb.prepare(`
    SELECT id, name, path, last_opened
    FROM recent_projects
    ORDER BY last_opened DESC
    LIMIT 10
`);
const stmtRemove = registryDb.prepare(
  "DELETE FROM recent_projects WHERE id = ?"
);
function upsertProject(id, name, projectPath) {
  stmtUpsert.run(id, name, projectPath);
}
function getRecentProjects() {
  return stmtGetRecent.all();
}
function removeProject(id) {
  stmtRemove.run(id);
}
export {
  getRecentProjects,
  removeProject,
  upsertProject
};
