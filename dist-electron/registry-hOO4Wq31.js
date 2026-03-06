import a from "better-sqlite3";
import s from "node:path";
import { app as p } from "electron";
const r = s.join(p.getPath("userData"), "bridge-registry.db"), e = new a(r);
e.pragma("journal_mode = WAL");
e.exec(`
    CREATE TABLE IF NOT EXISTS recent_projects (
        id          TEXT    PRIMARY KEY,
        name        TEXT    NOT NULL,
        path        TEXT    NOT NULL UNIQUE,
        last_opened INTEGER NOT NULL
    )
`);
console.log(`[Bridge] Registry ready at: ${r}`);
const E = e.prepare(`
    INSERT INTO recent_projects (id, name, path, last_opened)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(path) DO UPDATE SET
        name        = excluded.name,
        last_opened = strftime('%s', 'now')
`), c = e.prepare(`
    SELECT id, name, path, last_opened
    FROM recent_projects
    ORDER BY last_opened DESC
    LIMIT 10
`), T = e.prepare(
  "DELETE FROM recent_projects WHERE id = ?"
);
function R(t, o, n) {
  E.run(t, o, n);
}
function L() {
  return c.all();
}
function N(t) {
  T.run(t);
}
export {
  L as getRecentProjects,
  N as removeProject,
  R as upsertProject
};
