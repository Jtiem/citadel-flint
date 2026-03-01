import { app, ipcMain, dialog, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, rename, unlink, readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { transformSync } from "@babel/core";
import { jsxAttribute, jsxIdentifier, stringLiteral } from "@babel/types";
class FileTransactionManager {
  /** Active tail promise keyed by absolute file path. */
  _queues = /* @__PURE__ */ new Map();
  /**
   * Enqueues an atomic write for `filePath`.
   *
   * If a write is already in flight for this path the new write is chained
   * behind it, ensuring strict FIFO ordering without any external locking.
   *
   * @param filePath  Absolute path of the target file (must be pre-validated).
   * @param content   Complete UTF-8 content to commit to disk.
   * @returns         A Promise that resolves only once *this specific write*
   *                  has been committed — not merely queued.
   */
  write(filePath, content) {
    const tail = this._queues.get(filePath) ?? Promise.resolve();
    const next = tail.then(() => this._atomicWrite(filePath, content));
    let queued;
    const evict = () => {
      if (this._queues.get(filePath) === queued) {
        this._queues.delete(filePath);
      }
    };
    queued = next.then(evict, evict);
    this._queues.set(filePath, queued);
    return next;
  }
  /**
   * Performs the two-phase atomic write:
   *   1. `writeFile(tmpPath, content)` — full content lands on disk before
   *      any rename; a crash here leaves the original untouched.
   *   2. `rename(tmpPath, filePath)` — atomic replacement on POSIX/HFS+/APFS;
   *      readers see either the old or the new file, never an in-between state.
   *
   * On any failure the .tmp file is silently removed (best-effort) so stale
   * artefacts do not accumulate in the project directory.
   */
  async _atomicWrite(filePath, content) {
    const tmpPath = `${filePath}.tmp`;
    try {
      await writeFile(tmpPath, content, "utf8");
      await rename(tmpPath, filePath);
    } catch (err) {
      await unlink(tmpPath).catch(() => {
      });
      throw err;
    }
  }
}
const fileTransactionManager = new FileTransactionManager();
const EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "dist",
  "dist-electron",
  ".git",
  ".next",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache"
]);
async function scanDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const children = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const subtree = await scanDirectory(fullPath);
      if ((subtree.children?.length ?? 0) > 0) {
        children.push(subtree);
      }
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      children.push({ name: entry.name, path: fullPath, type: "file" });
    }
  }
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { name: path.basename(dirPath), path: dirPath, type: "directory", children };
}
const execFileAsync = promisify(execFile);
app.disableHardwareAcceleration();
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_DIST = path.join(__dirname$1, "../dist");
const PRELOAD_PATH = path.join(__dirname$1, "preload.js");
let mainWindow = null;
let stopServer = null;
function injectBridgeIdPlugin() {
  return {
    visitor: {
      JSXOpeningElement(path2) {
        const loc = path2.node.loc;
        if (loc == null) return;
        const nameNode = path2.node.name;
        let tagName;
        if (nameNode.type === "JSXIdentifier") {
          tagName = nameNode.name;
        } else if (nameNode.type === "JSXMemberExpression") {
          const obj = nameNode.object.type === "JSXIdentifier" ? nameNode.object.name : "?";
          tagName = `${obj}.${nameNode.property.name}`;
        } else {
          tagName = "unknown";
        }
        const bridgeId = `${tagName}:${loc.start.line}:${loc.start.column}`;
        const alreadySet = path2.node.attributes.some((attr) => {
          if (attr.type !== "JSXAttribute") return false;
          const name = attr.name;
          return name.type === "JSXIdentifier" && name.name === "data-bridge-id";
        });
        if (alreadySet) return;
        path2.node.attributes.push(
          jsxAttribute(
            jsxIdentifier("data-bridge-id"),
            stringLiteral(bridgeId)
          )
        );
      }
    }
  };
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Bridge IDE",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false is required because vite-plugin-electron builds the
      // preload as an ESM module. Electron's sandbox cannot bootstrap ESM
      // preloads; disabling it restores the Node.js-capable preload context.
      // Security is maintained by contextIsolation + contextBridge alone.
      // See: bridge-context/decisions.md
      sandbox: false
    }
  });
  mainWindow.webContents.openDevTools();
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("ping", () => "pong from Main Process ✓");
ipcMain.handle(
  "dialog:openFolder",
  async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open Project Folder",
      buttonLabel: "Open"
    });
    if (canceled || filePaths.length === 0) return null;
    const folderPath = path.normalize(filePaths[0]);
    const home = app.getPath("home");
    if (folderPath !== home && !folderPath.startsWith(home + path.sep)) {
      return null;
    }
    return scanDirectory(folderPath);
  }
);
ipcMain.handle("file:read", async (_event, filePath) => {
  if (typeof filePath !== "string") {
    throw new TypeError("file:read — filePath must be a string");
  }
  if (!path.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
    throw new Error("file:read — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file");
  }
  const home = app.getPath("home");
  if (!filePath.startsWith(home + path.sep)) {
    throw new Error("file:read — path outside user home directory is not permitted");
  }
  return readFile(filePath, "utf-8");
});
ipcMain.handle("code:transform", (_event, code) => {
  if (typeof code !== "string") {
    return { js: null, error: "code must be a string" };
  }
  try {
    const result = transformSync(code, {
      filename: "App.tsx",
      plugins: [
        ["@babel/plugin-transform-typescript", { isTSX: true, allExtensions: true }],
        injectBridgeIdPlugin,
        ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]
      ],
      configFile: false,
      babelrc: false,
      sourceMaps: false
    });
    if (result === null || result.code == null) {
      return { js: null, error: "Babel returned no output" };
    }
    let js = result.code;
    js = js.replace(/^import\s[^\n]*\n?/gm, "");
    let componentName = null;
    js = js.replace(
      /\bexport\s+default\s+(function|class)\s+(\w+)/,
      (_m, kw, name) => {
        componentName = name;
        return `${kw} ${name}`;
      }
    );
    if (componentName === null) {
      js = js.replace(
        /^export\s+default\s+(\w+)\s*;?\s*$/m,
        (_m, name) => {
          componentName = name;
          return "";
        }
      );
    }
    if (componentName !== null) {
      js += `
window.__AppComponent = ${componentName};`;
    }
    return { js, error: null };
  } catch (err) {
    return { js: null, error: String(err) };
  }
});
app.whenReady().then(async () => {
  const { default: db } = await import("./store-CGFKLE71.js");
  const stmtCreate = db.prepare(`
        INSERT INTO design_tokens
            (token_path, token_type, token_value, description, mode, collection_name)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(token_path, mode, collection_name) DO UPDATE SET
            token_value = excluded.token_value,
            description = excluded.description,
            updated_at  = strftime('%s', 'now')
    `);
  const stmtReadAll = db.prepare(`
        SELECT id, token_path, token_type, token_value, description, mode, collection_name
        FROM design_tokens
        ORDER BY collection_name, mode, token_path
    `);
  const stmtDelete = db.prepare(
    "DELETE FROM design_tokens WHERE id = ?"
  );
  const stmtClearAll = db.prepare("DELETE FROM design_tokens");
  ipcMain.handle("tokens:create", (_event, token) => {
    if (typeof token !== "object" || token === null || typeof token.token_path !== "string" || typeof token.token_type !== "string" || typeof token.token_value !== "string") {
      throw new Error("tokens:create — invalid payload shape");
    }
    const t = token;
    const mode = typeof t.mode === "string" && t.mode.trim() !== "" ? t.mode : "default";
    const collection_name = typeof t.collection_name === "string" && t.collection_name.trim() !== "" ? t.collection_name : "default";
    const result = stmtCreate.run(
      t.token_path,
      t.token_type,
      t.token_value,
      t.description ?? null,
      mode,
      collection_name
    );
    return { id: result.lastInsertRowid };
  });
  ipcMain.handle("tokens:read-all", () => stmtReadAll.all());
  ipcMain.handle("tokens:update", (_event, tokenPath, updates) => {
    if (typeof tokenPath !== "string" || tokenPath.trim() === "") {
      throw new Error("tokens:update — tokenPath must be a non-empty string");
    }
    if (typeof updates !== "object" || updates === null) {
      throw new Error("tokens:update — updates must be an object");
    }
    const u = updates;
    const setClauses = [];
    const params = [];
    if (typeof u.token_type === "string") {
      setClauses.push("token_type = ?");
      params.push(u.token_type);
    }
    if (typeof u.token_value === "string") {
      setClauses.push("token_value = ?");
      params.push(u.token_value);
    }
    if ("description" in u) {
      setClauses.push("description = ?");
      params.push(typeof u.description === "string" ? u.description : null);
    }
    if (setClauses.length === 0) {
      throw new Error("tokens:update — at least one field must be provided");
    }
    setClauses.push("updated_at = strftime('%s', 'now')");
    const sql = `UPDATE design_tokens SET ${setClauses.join(", ")} WHERE token_path = ?`;
    const result = db.prepare(sql).run(...params, tokenPath);
    return { changes: result.changes };
  });
  ipcMain.handle("tokens:delete", (_event, id) => {
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new Error("tokens:delete — id must be an integer");
    }
    const result = stmtDelete.run(id);
    return { changes: result.changes };
  });
  ipcMain.handle("tokens:clear-all", () => {
    const result = stmtClearAll.run();
    console.log(`[Bridge] tokens:clear-all: removed ${result.changes} tokens`);
    return { changes: result.changes };
  });
  ipcMain.handle("tokens:clear-override", (_event, bridgeId) => {
    if (typeof bridgeId !== "string" || bridgeId.length === 0) return;
    db.prepare("DELETE FROM component_overrides WHERE bridge_id = ?").run(bridgeId);
  });
  ipcMain.handle(
    "tokens:upsert-override",
    (_event, bridgeId, propertyKey, propertyValue) => {
      if (typeof bridgeId !== "string" || bridgeId.length === 0 || typeof propertyKey !== "string" || propertyKey.length === 0 || typeof propertyValue !== "string") return;
      db.prepare(
        `INSERT OR REPLACE INTO component_overrides
                    (bridge_id, property_key, property_value, updated_at)
                 VALUES (?, ?, ?, strftime('%s','now'))`
      ).run(bridgeId, propertyKey, propertyValue);
    }
  );
  const stmtUpsertPresence = db.prepare(`
        INSERT INTO presence (id, user_id, node_id, x, y, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(id) DO UPDATE SET
            user_id    = excluded.user_id,
            node_id    = excluded.node_id,
            x          = excluded.x,
            y          = excluded.y,
            updated_at = strftime('%s', 'now')
    `);
  ipcMain.handle("sync:update-presence", (_event, payload) => {
    if (typeof payload !== "object" || payload === null || typeof payload.id !== "string" || typeof payload.userId !== "string" || typeof payload.x !== "number" || typeof payload.y !== "number") {
      throw new Error("sync:update-presence — invalid payload");
    }
    const p = payload;
    stmtUpsertPresence.run(p.id, p.userId, p.nodeId ?? "", p.x, p.y);
  });
  const stmtReadPresence = db.prepare(`
        SELECT id, user_id, node_id, x, y, updated_at
        FROM presence
        WHERE updated_at > strftime('%s', 'now') - 30
    `);
  ipcMain.handle("sync:read-presence", () => {
    return stmtReadPresence.all();
  });
  ipcMain.handle("ast:save-file", async (_event, filePath, content) => {
    if (typeof filePath !== "string" || typeof content !== "string") {
      throw new TypeError("ast:save-file — filePath and content must be strings");
    }
    if (!path.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
      throw new Error("ast:save-file — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file");
    }
    const home = app.getPath("home");
    if (!filePath.startsWith(home + path.sep)) {
      throw new Error("ast:save-file — path outside user home directory is not permitted");
    }
    await fileTransactionManager.write(filePath, content);
  });
  ipcMain.handle(
    "ast:git-show",
    async (_event, filePath, commitHash) => {
      if (typeof filePath !== "string" || typeof commitHash !== "string") return null;
      if (!/^[0-9a-fA-F]{4,64}$/.test(commitHash)) return null;
      if (!path.isAbsolute(filePath)) return null;
      const home = app.getPath("home");
      if (!filePath.startsWith(home + path.sep)) return null;
      try {
        const cwd = path.dirname(filePath);
        const { stdout: rootRaw } = await execFileAsync(
          "git",
          ["rev-parse", "--show-toplevel"],
          { cwd }
        );
        const gitRoot = rootRaw.trim();
        const relPath = path.relative(gitRoot, filePath);
        const { stdout } = await execFileAsync(
          "git",
          ["show", `${commitHash}:${relPath}`],
          { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 }
        );
        return stdout;
      } catch {
        return null;
      }
    }
  );
  const { startIngestionServer, getServerStatus, stopIngestionServer } = await import("./ingestion-server-CG0NJExU.js");
  startIngestionServer();
  stopServer = stopIngestionServer;
  ipcMain.handle("server:get-status", () => getServerStatus());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("will-quit", () => {
  stopServer?.();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  mainWindow = null;
});
