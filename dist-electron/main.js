import { app, ipcMain, dialog, BrowserWindow, Menu } from "electron";
import path__default from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, rename, unlink, realpath, readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import * as pty from "node-pty";
import { promisify } from "node:util";
import { transformSync } from "@babel/core";
import { parse } from "@babel/parser";
import { jsxAttribute, jsxIdentifier, stringLiteral } from "@babel/types";
import { resolveConfig, createServer } from "vite";
import net from "node:net";
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
   * Enqueues atomic writes for every `(filePath, content)` pair in `batch`
   * and resolves once **all** of them have been committed to disk.
   *
   * Each path is handled by the existing per-path FIFO queue, so:
   *   • Rapid-fire batch calls for the same path are still serialised.
   *   • Writes to different paths run concurrently (unchanged behaviour).
   *   • A failure for one path rejects the returned Promise but does not
   *     prevent the other paths from completing.
   *
   * Callers must pre-validate all paths (absolute, correct extension, within
   * the home directory) before passing them in — this method does not
   * re-validate.
   */
  writeBatch(batch) {
    const writes = [];
    for (const [filePath, content] of batch) {
      writes.push(this.write(filePath, content));
    }
    return Promise.all(writes).then(() => void 0);
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
const execFileAsync$1 = promisify(execFile);
const GITIGNORE_CONTENT = "node_modules\n.bridge/tmp\n";
function findBridgeIdOffsets(node, targetId) {
  if (node.type === "JSXElement") {
    for (const attr of node.openingElement.attributes) {
      if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === "data-bridge-id") {
        console.log("found data-bridge-id attr:", attr.value);
      }
      if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === "data-bridge-id" && attr.value?.type === "StringLiteral" && attr.value.value === targetId && node.start != null && node.end != null) {
        return [node.start, node.end];
      }
    }
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item != null && typeof item === "object" && "type" in item) {
          const found = findBridgeIdOffsets(item, targetId);
          if (found) return found;
        }
      }
    } else if (child != null && typeof child === "object" && "type" in child) {
      const found = findBridgeIdOffsets(child, targetId);
      if (found) return found;
    }
  }
  return null;
}
class GitManager {
  /**
   * Ensures `projectPath` has an initialised git repository.
   *
   * If `.git` is absent:
   *   1. Runs `git init`
   *   2. Writes `.gitignore` (node_modules, .bridge/tmp)
   *   3. Configures repo-local identity (bridge@local / Bridge IDE) so commits
   *      work in environments with no global git user config.
   *   4. Stages all files with `git add .`
   *   5. Creates an initial `bridge:init` commit (--allow-empty for safety).
   *
   * Idempotent — if `.git` already exists the method returns immediately.
   */
  async ensureRepo(projectPath) {
    try {
      await execFileAsync$1("git", ["rev-parse", "--git-dir"], { cwd: projectPath });
      return;
    } catch {
    }
    await execFileAsync$1("git", ["init"], { cwd: projectPath });
    await writeFile(path__default.join(projectPath, ".gitignore"), GITIGNORE_CONTENT, "utf8");
    await execFileAsync$1("git", ["config", "user.email", "bridge@local"], { cwd: projectPath });
    await execFileAsync$1("git", ["config", "user.name", "Bridge IDE"], { cwd: projectPath });
    await execFileAsync$1("git", ["add", "."], { cwd: projectPath });
    await execFileAsync$1(
      "git",
      ["commit", "-m", "bridge:init", "--allow-empty"],
      { cwd: projectPath }
    );
    console.log(`[Bridge] GitManager: initialised git repo at ${projectPath}`);
  }
  /**
   * Stages all working-tree changes under the git root containing `cwd` and
   * creates a shadow commit labelled "bridge:sync:{batchId}".
   *
   * Silent no-op when:
   *   - `cwd` is not inside a git repository.
   *   - The working tree has no staged or unstaged changes to commit.
   *
   * MUST be called only after `fileTransactionManager` resolves (Commandment 13)
   * so the disk state is flushed before the commit is generated.
   *
   * @param cwd     — Any directory within the target project (used to find git root).
   * @param batchId — Optional label appended to the commit message.
   *                  Defaults to a random UUID if omitted.
   */
  async shadowCommit(cwd, batchId) {
    const gitRoot = await this._getGitRoot(cwd);
    if (!gitRoot) return;
    const id = batchId ?? randomUUID();
    await execFileAsync$1("git", ["add", "."], { cwd: gitRoot });
    const { stdout: status } = await execFileAsync$1(
      "git",
      ["status", "--porcelain"],
      { cwd: gitRoot }
    );
    if (!status.trim()) return;
    await execFileAsync$1(
      "git",
      ["commit", "-m", `bridge:sync:${id}`],
      { cwd: gitRoot }
    );
    console.log(`[Bridge] GitManager: shadow commit bridge:sync:${id}`);
  }
  /**
   * Returns the JSX source text of the element with `dataBridgeId` from
   * `filePath` at `commitHash`.
   *
   * Steps:
   *   1. Resolves the git root from `filePath`'s directory.
   *   2. Runs `git show <commitHash>:<relPath>` to retrieve historical content.
   *   3. Parses with @babel/parser (TypeScript + JSX plugins).
   *   4. Walks the AST to locate the JSXElement with the matching bridge ID.
   *   5. Returns the raw source slice for that element.
   *
   * Returns null when:
   *   - `filePath` is not in a git repository.
   *   - The commit or file does not exist in git history.
   *   - No element with the given bridge ID exists in the historical file.
   *   - The file cannot be parsed as TypeScript/JSX.
   *
   * Read-only — never calls `git checkout` (Commandment 11).
   */
  async getGitNode(commitHash, filePath, dataBridgeId) {
    const gitRoot = await this._getGitRoot(path__default.dirname(filePath));
    if (!gitRoot) return null;
    const realFilePath = await realpath(filePath).catch(() => filePath);
    const relPath = path__default.relative(gitRoot, realFilePath);
    let content;
    try {
      const { stdout } = await execFileAsync$1(
        "git",
        ["show", `${commitHash}:${relPath}`],
        { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 }
      );
      content = stdout;
    } catch (e) {
      console.error("git show failed:", e);
      return null;
    }
    try {
      const ast = parse(content, {
        sourceType: "module",
        plugins: ["typescript", "jsx"]
      });
      const offsets = findBridgeIdOffsets(ast.program, dataBridgeId);
      return offsets ? content.slice(offsets[0], offsets[1]) : null;
    } catch (e) {
      console.error("parse failed:", e);
      return null;
    }
  }
  // ── Private helpers ───────────────────────────────────────────────────────
  /**
   * Returns the absolute git root for `cwd`, or null if the directory is not
   * inside a git repository.
   */
  async _getGitRoot(cwd) {
    try {
      const { stdout } = await execFileAsync$1(
        "git",
        ["rev-parse", "--show-toplevel"],
        { cwd }
      );
      return stdout.trim();
    } catch {
      return null;
    }
  }
}
const gitManager = new GitManager();
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr == null || typeof addr === "string") {
        srv.close();
        reject(new Error("Could not determine free port"));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
const BRIDGE_SCRIPT = (
  /* html */
  `
<script id="__bridge_interact__">
(function(){
  if(document.getElementById('__bridge_interact_active__'))return;
  var sentinel=document.createElement('meta');sentinel.id='__bridge_interact_active__';document.head.appendChild(sentinel);
  window.__bridgeInteractMode=false;
  window.addEventListener('message',function(e){
    if(!e.data)return;var t=e.data.type;
    if(t==='SET_INTERACT_MODE'){window.__bridgeInteractMode=!!e.data.enabled;return;}
    if(t==='CLEAR_PREVIEW'){document.body.innerHTML='';return;}
    if(t==='HIGHLIGHT'){
      document.querySelectorAll('.bridge-selected').forEach(function(el){el.classList.remove('bridge-selected');});
      if(e.data.id){var s=document.querySelector('[data-bridge-id="'+e.data.id+'"]');if(s)s.classList.add('bridge-selected');}return;
    }
    if(t==='HOVER'){
      document.querySelectorAll('.bridge-hovered').forEach(function(el){el.classList.remove('bridge-hovered');});
      if(e.data.id){var h=document.querySelector('[data-bridge-id="'+e.data.id+'"]');if(h)h.classList.add('bridge-hovered');}return;
    }
    if(t==='CLEAR_HOVER'){document.querySelectorAll('.bridge-hovered').forEach(function(el){el.classList.remove('bridge-hovered');});return;}
    if(t==='DRAG_OVER'){
      document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
      if(e.data.targetId){var d=document.querySelector('[data-bridge-id="'+e.data.targetId+'"]');if(d)d.classList.add('bridge-drop-'+e.data.position);}return;
    }
    if(t==='DRAG_CLEAR'){
      var g=document.getElementById('__bridge_ghost__');if(g)g.style.display='none';
      document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});return;
    }
    if(t==='DRAG_MOVE'){
      var gm=document.getElementById('__bridge_ghost__');if(gm){gm.style.display='block';gm.style.left=(e.data.x-40)+'px';gm.style.top=(e.data.y-20)+'px';}
      var dme=document.elementFromPoint(e.data.x,e.data.y);var dmt=dme?dme.closest('[data-bridge-id]'):null;
      document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
      if(dmt){var r=dmt.getBoundingClientRect();var pct=(e.data.y-r.top)/r.height;dmt.classList.add('bridge-drop-'+(pct<0.25?'before':pct>0.75?'after':'inside'));}return;
    }
    if(t==='DRAG_END'){
      var ge=document.getElementById('__bridge_ghost__');if(ge)ge.style.display='none';
      document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
      var de=document.elementFromPoint(e.data.x,e.data.y);var dt=de?de.closest('[data-bridge-id]'):null;
      var dp='inside';if(dt){var dr=dt.getBoundingClientRect();var dpp=(e.data.y-dr.top)/dr.height;dp=dpp<0.25?'before':dpp>0.75?'after':'inside';}
      window.parent.postMessage({type:'HIT_TEST_RESULT',targetId:dt?dt.getAttribute('data-bridge-id'):null,position:dp},'*');return;
    }
  });
  document.addEventListener('paste', function(e){
    if(window.__bridgeInteractMode)return;
    var f=e.clipboardData?e.clipboardData.getData('application/x-bridge-figma-ast'):null;
    if(!f&&e.clipboardData){
      var t=e.clipboardData.getData('text/plain');
      if(t){
        try{
          var p=JSON.parse(t);
          if(p&&p.type==='application/x-bridge-figma-ast'){f=typeof p.payload==='string'?p.payload:JSON.stringify(p.payload);}
        }catch(err){}
      }
    }
    if(f){
      e.preventDefault();
      window.parent.postMessage({type:'FIGMA_PASTE',payload:f},'*');
    }
  });
  document.addEventListener('click',function(e){
    if(window.__bridgeInteractMode)return;
    var el=e.target.closest('[data-bridge-id]');
    if(el)window.parent.postMessage({type:'CANVAS_CLICK',id:el.getAttribute('data-bridge-id')},'*');
  });
  var _hid=null;
  document.body.addEventListener('mouseover',function(e){
    if(window.__bridgeInteractMode)return;
    var el=e.target.closest('[data-bridge-id]');var id=el?el.getAttribute('data-bridge-id'):null;
    if(id!==_hid){_hid=id;window.parent.postMessage(id?{type:'CANVAS_HOVER',id:id}:{type:'CANVAS_HOVER_CLEAR'},'*');}
  });
  document.body.addEventListener('mouseleave',function(){if(_hid!==null){_hid=null;window.parent.postMessage({type:'CANVAS_HOVER_CLEAR'},'*');}});
  var _bg=document.createElement('div');_bg.id='__bridge_ghost__';
  _bg.style.cssText='position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.12);border-radius:4px;z-index:9999;display:none;width:80px;height:40px;';
  document.body.appendChild(_bg);
  document.body.addEventListener('mousedown',function(e){
    if(window.__bridgeInteractMode)return;
    var el=e.target.closest('[data-bridge-id]');if(!el)return;
    e.preventDefault();
    window.parent.postMessage({type:'CANVAS_DRAG_START',id:el.getAttribute('data-bridge-id'),x:e.clientX,y:e.clientY},'*');
  });
})();
<\/script>
<style id="__bridge_styles__">
.bridge-selected{outline:2px solid #3b82f6!important;background-color:rgba(59,130,246,.1)!important;}
.bridge-hovered{outline:2px dashed #94a3b8!important;background:rgba(148,163,184,.1)!important;cursor:default;z-index:40;transition:all .1s;}
.bridge-drop-before{box-shadow:0 -3px 0 0 #3b82f6!important;z-index:50;}
.bridge-drop-after{box-shadow:0 3px 0 0 #3b82f6!important;z-index:50;}
.bridge-drop-inside{outline:2px solid #3b82f6!important;background:rgba(59,130,246,.2)!important;}
</style>
`
);
function bridgeInteractPlugin() {
  return {
    name: "bridge-interact",
    transformIndexHtml(html) {
      return html.replace("</body>", `${BRIDGE_SCRIPT}
</body>`);
    },
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        const originalSetHeader = res.setHeader;
        res.setHeader = function(name, value) {
          if (name.toLowerCase() === "content-security-policy") {
            return this;
          }
          return originalSetHeader.call(this, name, value);
        };
        next();
      });
    }
  };
}
let _server = null;
let _port = null;
async function startViteServer(projectRoot) {
  if (_server !== null) {
    await stopViteServer();
  }
  _port = await findFreePort();
  let userPlugins = [];
  try {
    const resolved = await resolveConfig({ root: projectRoot }, "serve");
    userPlugins = resolved.plugins ?? [];
  } catch {
  }
  _server = await createServer({
    root: projectRoot,
    base: "/",
    server: {
      port: _port,
      strictPort: false,
      host: "127.0.0.1",
      // Disable HMR overlay in favor of Bridge's own error panel.
      hmr: { overlay: false }
    },
    plugins: [
      ...userPlugins,
      bridgeInteractPlugin()
    ],
    // Suppress Vite's banner — Bridge has its own status bar.
    logLevel: "warn",
    clearScreen: false,
    // Required to allow Electron's renderer (file://) to iframe the preview
    configFile: false
    // Don't re-read vite.config — we already resolved it above
  });
  await _server.listen();
  const url = `http://127.0.0.1:${_port}`;
  console.info(`[Bridge] Preview engine (Vite N.4) listening at ${url}`);
  return url;
}
async function stopViteServer() {
  if (_server !== null) {
    await _server.close();
    _server = null;
    _port = null;
    console.info("[Bridge] Preview engine stopped.");
  }
}
function getPreviewUrl() {
  if (_server === null || _port === null) return null;
  return `http://127.0.0.1:${_port}`;
}
let activeProjectRoot = null;
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
    const fullPath = path__default.join(dirPath, entry.name);
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
  return { name: path__default.basename(dirPath), path: dirPath, type: "directory", children };
}
const execFileAsync = promisify(execFile);
app.disableHardwareAcceleration();
const __dirname$1 = path__default.dirname(fileURLToPath(import.meta.url));
const RENDERER_DIST = path__default.join(__dirname$1, "../dist");
const PRELOAD_PATH = path__default.join(__dirname$1, "preload.js");
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
function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    // macOS requires the first menu item to be the app menu (shows the app name).
    ...isMac ? [{ role: "appMenu" }] : [],
    // ── File ──────────────────────────────────────────────────────────────
    {
      label: "File",
      submenu: [
        {
          label: "New Project…",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("menu:new-project");
          }
        },
        {
          label: "Open Project…",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow?.webContents.send("menu:open-project");
          }
        },
        { type: "separator" },
        {
          label: "Close Project",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => {
            mainWindow?.webContents.send("menu:close-project");
          }
        }
      ]
    },
    // ── Edit / View / Window ─────────────────────────────────────────────
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
    mainWindow.loadFile(path__default.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("ping", () => "pong from Main Process ✓");
ipcMain.handle(
  "dialog:openFolder",
  async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Open Project Folder",
      buttonLabel: "Open"
    });
    if (canceled || filePaths.length === 0) return null;
    const folderPath = path__default.normalize(filePaths[0]);
    const home = app.getPath("home");
    if (folderPath !== home && !folderPath.startsWith(home + path__default.sep)) {
      return null;
    }
    await gitManager.ensureRepo(folderPath).catch((err) => {
      console.error(`[Bridge] main.ts: ensureRepo failed for ${folderPath}`, err);
    });
    activeProjectRoot = folderPath;
    return scanDirectory(folderPath);
  }
);
ipcMain.handle("file:read", async (_event, filePath) => {
  if (typeof filePath !== "string") {
    throw new TypeError("file:read — filePath must be a string");
  }
  if (!path__default.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
    throw new Error("file:read — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file");
  }
  const home = app.getPath("home");
  if (!filePath.startsWith(home + path__default.sep)) {
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
ipcMain.handle("preview:start", async (_event, projectRoot) => {
  if (typeof projectRoot !== "string" || !path__default.isAbsolute(projectRoot)) {
    return { error: "preview:start — projectRoot must be an absolute path" };
  }
  const home = app.getPath("home");
  if (projectRoot !== home && !projectRoot.startsWith(home + path__default.sep)) {
    return { error: "preview:start — path outside user home directory is not permitted" };
  }
  try {
    const url = await startViteServer(projectRoot);
    return { url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Bridge] preview:start failed:", msg);
    return { error: `Preview server failed to start: ${msg}` };
  }
});
ipcMain.handle("preview:stop", async () => {
  await stopViteServer();
});
ipcMain.handle("preview:url", () => {
  return getPreviewUrl();
});
app.whenReady().then(async () => {
  const { default: db } = await import("./store-BF_pllbt.js");
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
  function broadcastTokensUpdated() {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send("bridge:tokens-updated");
    });
  }
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
    broadcastTokensUpdated();
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
    broadcastTokensUpdated();
    return { changes: result.changes };
  });
  ipcMain.handle("tokens:delete", (_event, id) => {
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new Error("tokens:delete — id must be an integer");
    }
    const result = stmtDelete.run(id);
    broadcastTokensUpdated();
    return { changes: result.changes };
  });
  ipcMain.handle("tokens:clear-all", () => {
    const result = stmtClearAll.run();
    console.log(`[Bridge] tokens:clear-all: removed ${result.changes} tokens`);
    broadcastTokensUpdated();
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
  const stmtReadOverrides = db.prepare(`
        SELECT bridge_id, property_key, property_value, updated_at
        FROM component_overrides
        ORDER BY updated_at DESC
    `);
  ipcMain.handle("tokens:read-overrides", () => stmtReadOverrides.all());
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
    if (!path__default.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
      throw new Error("ast:save-file — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file");
    }
    const home = app.getPath("home");
    if (!filePath.startsWith(home + path__default.sep)) {
      throw new Error("ast:save-file — path outside user home directory is not permitted");
    }
    await fileTransactionManager.write(filePath, content);
    await gitManager.shadowCommit(path__default.dirname(filePath)).catch((err) => {
      console.error("[Bridge] main.ts: ast:save-file shadowCommit failed", err);
    });
  });
  ipcMain.handle("ast:save-batch", async (_event, batch) => {
    if (typeof batch !== "object" || batch === null || Array.isArray(batch)) {
      throw new TypeError("ast:save-batch — batch must be a plain object");
    }
    const home = app.getPath("home");
    const validated = /* @__PURE__ */ new Map();
    for (const [filePath, content] of Object.entries(batch)) {
      if (typeof content !== "string") {
        throw new TypeError(`ast:save-batch — content for "${filePath}" must be a string`);
      }
      if (!path__default.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
        throw new Error(
          `ast:save-batch — "${filePath}" must be an absolute path to a .tsx/.ts/.jsx/.js file`
        );
      }
      if (!filePath.startsWith(home + path__default.sep)) {
        throw new Error(
          `ast:save-batch — "${filePath}" is outside the user home directory`
        );
      }
      validated.set(filePath, content);
    }
    await fileTransactionManager.writeBatch(validated);
    const firstPath = Object.keys(validated)[0];
    if (firstPath) {
      await gitManager.shadowCommit(path__default.dirname(firstPath)).catch((err) => {
        console.error("[Bridge] main.ts: ast:save-batch shadowCommit failed", err);
      });
    }
  });
  ipcMain.handle(
    "ast:git-show",
    async (_event, filePath, commitHash) => {
      if (typeof filePath !== "string" || typeof commitHash !== "string") return null;
      if (!/^([0-9a-fA-F]{4,64}|HEAD)$/.test(commitHash)) return null;
      if (!path__default.isAbsolute(filePath)) return null;
      const home = app.getPath("home");
      if (!filePath.startsWith(home + path__default.sep)) return null;
      try {
        const cwd = path__default.dirname(filePath);
        const { stdout: rootRaw } = await execFileAsync(
          "git",
          ["rev-parse", "--show-toplevel"],
          { cwd }
        );
        const gitRoot = rootRaw.trim();
        const relPath = path__default.relative(gitRoot, filePath);
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
  ipcMain.handle(
    "ast:git-log",
    async (_event, filePath) => {
      if (typeof filePath !== "string") return [];
      if (!path__default.isAbsolute(filePath)) return [];
      const home = app.getPath("home");
      if (!filePath.startsWith(home + path__default.sep)) return [];
      try {
        const cwd = path__default.dirname(filePath);
        const { stdout: rootRaw } = await execFileAsync(
          "git",
          ["rev-parse", "--show-toplevel"],
          { cwd }
        );
        const gitRoot = rootRaw.trim();
        const relPath = path__default.relative(gitRoot, filePath);
        const { stdout } = await execFileAsync(
          "git",
          ["log", "--pretty=format:%h|%s|%at", "-n", "50", "--", relPath],
          { cwd: gitRoot, maxBuffer: 1024 * 1024 }
        );
        const entries = [];
        for (const line of stdout.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split("|");
          if (parts.length < 3) continue;
          const hash = parts[0];
          const timestamp = parseInt(parts[parts.length - 1], 10);
          const message = parts.slice(1, parts.length - 1).join("|");
          if (hash && !isNaN(timestamp)) {
            entries.push({ hash, message, timestamp });
          }
        }
        return entries;
      } catch {
        return [];
      }
    }
  );
  const { upsertProject, getRecentProjects, removeProject } = await import("./registry-tjjNUxSY.js");
  const { initializeProject, injectDemoState } = await import("./templateService-BiF-1Cj-.js");
  ipcMain.handle("dialog:selectFolder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Empty Folder for New Project",
      buttonLabel: "Select Folder"
    });
    if (canceled || filePaths.length === 0) return null;
    const folderPath = path__default.normalize(filePaths[0]);
    const home = app.getPath("home");
    if (folderPath !== home && !folderPath.startsWith(home + path__default.sep)) return null;
    return folderPath;
  });
  ipcMain.handle("project:initialize", async (_event, payload) => {
    if (typeof payload !== "object" || payload === null || typeof payload.targetPath !== "string" || typeof payload.templateId !== "string") {
      throw new TypeError("project:initialize — invalid payload shape");
    }
    const { targetPath, templateId } = payload;
    if (!path__default.isAbsolute(targetPath)) {
      throw new Error("project:initialize — targetPath must be absolute");
    }
    const home = app.getPath("home");
    if (targetPath !== home && !targetPath.startsWith(home + path__default.sep)) {
      throw new Error("project:initialize — targetPath must be inside the user home directory");
    }
    initializeProject(targetPath, templateId);
    await gitManager.ensureRepo(targetPath).catch((err) => {
      console.error(`[Bridge] main.ts: ensureRepo failed for new project ${targetPath}`, err);
    });
    const projectName = path__default.basename(targetPath);
    upsertProject(randomUUID(), projectName, targetPath);
    return scanDirectory(targetPath);
  });
  ipcMain.handle("project:reset-to-demo", async (_event, targetPath) => {
    if (typeof targetPath !== "string") {
      throw new TypeError("project:reset-to-demo — targetPath must be a string");
    }
    if (!path__default.isAbsolute(targetPath)) {
      throw new Error("project:reset-to-demo — targetPath must be absolute");
    }
    const home = app.getPath("home");
    if (targetPath !== home && !targetPath.startsWith(home + path__default.sep)) {
      throw new Error("project:reset-to-demo — targetPath must be inside the user home directory");
    }
    injectDemoState(targetPath);
    await gitManager.ensureRepo(targetPath).catch((err) => {
      console.error(`[Bridge] main.ts: ensureRepo failed for reset project ${targetPath}`, err);
    });
    return scanDirectory(targetPath);
  });
  ipcMain.handle("project:openPath", async (_event, folderPath) => {
    if (typeof folderPath !== "string") return null;
    const normalized = path__default.normalize(folderPath);
    const home = app.getPath("home");
    if (normalized !== home && !normalized.startsWith(home + path__default.sep)) return null;
    try {
      await gitManager.ensureRepo(normalized).catch((err) => {
        console.error(`[Bridge] main.ts: ensureRepo failed for ${normalized}`, err);
      });
      const tree = await scanDirectory(normalized);
      const projectName = path__default.basename(normalized);
      upsertProject(randomUUID(), projectName, normalized);
      activeProjectRoot = normalized;
      return tree;
    } catch {
      return null;
    }
  });
  ipcMain.handle("registry:getRecent", () => {
    return getRecentProjects();
  });
  ipcMain.handle("registry:upsertProject", (_event, payload) => {
    if (typeof payload !== "object" || payload === null || typeof payload.name !== "string" || typeof payload.path !== "string") return;
    const { name, path: projectPath } = payload;
    if (!path__default.isAbsolute(projectPath)) return;
    upsertProject(randomUUID(), name, projectPath);
  });
  ipcMain.handle("registry:removeProject", (_event, id) => {
    if (typeof id !== "string" || id.length === 0) return;
    removeProject(id);
  });
  const { sendChatMessage, readConfig: readAIConfig, writeConfig: writeAIConfig, hasApiKey } = await import("./orchestrator-Dr3IJ0jQ.js");
  ipcMain.handle("ai:get-config", async () => {
    const cfg = await readAIConfig();
    return {
      hasKey: await hasApiKey(),
      provider: cfg.provider ?? "anthropic",
      model: cfg.model ?? null,
      baseURL: cfg.baseURL ?? null
    };
  });
  ipcMain.handle("ai:save-config", async (_event, payload) => {
    if (typeof payload !== "object" || payload === null) return;
    const p = payload;
    const patch = {
      provider: typeof p.provider === "string" && p.provider ? p.provider : "anthropic"
    };
    if (typeof p.apiKey === "string" && p.apiKey.length > 0) patch.apiKey = p.apiKey;
    if (typeof p.model === "string" && p.model.length > 0) patch.model = p.model;
    if (typeof p.baseURL === "string") patch.baseURL = p.baseURL.trim() || void 0;
    await writeAIConfig(patch);
  });
  ipcMain.handle("ai:chat", async (event, messages, _context) => {
    if (!Array.isArray(messages)) return;
    const chatMessages = messages.filter((m) => typeof m.content === "string" && ["user", "assistant", "tool_call", "tool_result"].includes(m.role)).map((m) => ({
      role: m.role,
      content: m.content,
      ...m.toolUseId !== void 0 && { toolUseId: m.toolUseId },
      ...m.toolName !== void 0 && { toolName: m.toolName },
      ...m.toolInput !== void 0 && { toolInput: m.toolInput }
    }));
    await sendChatMessage(chatMessages, (chunk) => {
      event.sender.send("ai:chunk", chunk);
    });
  });
  ipcMain.handle("ai:apply-batch", () => ({ ok: true }));
  ipcMain.handle("bridge:hydro-paste", async (_event, payloadStr) => {
    if (typeof payloadStr !== "string") return { error: "Invalid payload" };
    try {
      let stylesToTailwind = function(styles) {
        if (!styles) return "";
        const cls = [];
        if (styles.layoutMode === "HORIZONTAL") {
          cls.push("flex", "flex-row");
        } else if (styles.layoutMode === "VERTICAL") {
          cls.push("flex", "flex-col");
        }
        if (styles.itemSpacing != null && styles.itemSpacing > 0) {
          const gap = spacingToTw(styles.itemSpacing);
          cls.push(gap ? `gap-${gap}` : `gap-[${styles.itemSpacing}px]`);
        }
        const pt = styles.paddingTop, pr = styles.paddingRight, pb = styles.paddingBottom, pl = styles.paddingLeft;
        if (pt != null || pr != null || pb != null || pl != null) {
          if (pt === pr && pr === pb && pb === pl && pt > 0) {
            const p = spacingToTw(pt);
            cls.push(p ? `p-${p}` : `p-[${pt}px]`);
          } else {
            if (pt != null && pt > 0) {
              const v = spacingToTw(pt);
              cls.push(v ? `pt-${v}` : `pt-[${pt}px]`);
            }
            if (pr != null && pr > 0) {
              const v = spacingToTw(pr);
              cls.push(v ? `pr-${v}` : `pr-[${pr}px]`);
            }
            if (pb != null && pb > 0) {
              const v = spacingToTw(pb);
              cls.push(v ? `pb-${v}` : `pb-[${pb}px]`);
            }
            if (pl != null && pl > 0) {
              const v = spacingToTw(pl);
              cls.push(v ? `pl-${v}` : `pl-[${pl}px]`);
            }
          }
        }
        if (styles.primaryAxisAlignItems) {
          const map = { MIN: "justify-start", CENTER: "justify-center", MAX: "justify-end", SPACE_BETWEEN: "justify-between" };
          if (map[styles.primaryAxisAlignItems]) cls.push(map[styles.primaryAxisAlignItems]);
        }
        if (styles.counterAxisAlignItems) {
          const map = { MIN: "items-start", CENTER: "items-center", MAX: "items-end" };
          if (map[styles.counterAxisAlignItems]) cls.push(map[styles.counterAxisAlignItems]);
        }
        if (styles.width != null && styles.width > 0) {
          const w = spacingToTw(styles.width);
          cls.push(w ? `w-${w}` : `w-[${styles.width}px]`);
        }
        if (styles.height != null && styles.height > 0) {
          const h = spacingToTw(styles.height);
          cls.push(h ? `h-${h}` : `h-[${styles.height}px]`);
        }
        if (styles.fillColor) {
          cls.push(`bg-[${styles.fillColor}]`);
          if (styles.fillOpacity != null) {
            cls.push(`bg-opacity-${roundOpacity(styles.fillOpacity)}`);
          }
        }
        if (styles.strokeColor) {
          cls.push("border", `border-[${styles.strokeColor}]`);
          if (styles.strokeWeight != null && styles.strokeWeight !== 1) {
            cls.push(`border-[${styles.strokeWeight}px]`);
          }
        }
        if (styles.cornerRadius != null && styles.cornerRadius > 0) {
          const r = styles.cornerRadius;
          const rMap = { 2: "rounded-sm", 4: "rounded", 6: "rounded-md", 8: "rounded-lg", 12: "rounded-xl", 16: "rounded-2xl", 9999: "rounded-full" };
          cls.push(rMap[r] || `rounded-[${r}px]`);
        }
        if (styles.opacity != null && styles.opacity < 100) {
          cls.push(`opacity-${roundOpacity(styles.opacity)}`);
        }
        if (styles.fontSize) {
          const fsMap = { 12: "text-xs", 14: "text-sm", 16: "text-base", 18: "text-lg", 20: "text-xl", 24: "text-2xl", 30: "text-3xl", 36: "text-4xl", 48: "text-5xl", 60: "text-6xl" };
          cls.push(fsMap[styles.fontSize] || `text-[${styles.fontSize}px]`);
        }
        if (styles.fontStyle) {
          const weight = styles.fontStyle.toLowerCase();
          const fwMap = { thin: "font-thin", extralight: "font-extralight", light: "font-light", regular: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold", extrabold: "font-extrabold", black: "font-black" };
          if (fwMap[weight]) cls.push(fwMap[weight]);
        }
        if (styles.textColor) {
          cls.push(`text-[${styles.textColor}]`);
        }
        if (styles.letterSpacing && styles.letterSpacing !== 0) {
          cls.push(`tracking-[${styles.letterSpacing}px]`);
        }
        if (styles.lineHeight) {
          cls.push(`leading-[${styles.lineHeight}px]`);
        }
        return cls.join(" ");
      }, spacingToTw = function(px) {
        const scale = {
          0: "0",
          1: "px",
          2: "0.5",
          4: "1",
          6: "1.5",
          8: "2",
          10: "2.5",
          12: "3",
          14: "3.5",
          16: "4",
          20: "5",
          24: "6",
          28: "7",
          32: "8",
          36: "9",
          40: "10",
          44: "11",
          48: "12",
          56: "14",
          64: "16",
          80: "20",
          96: "24",
          112: "28",
          128: "32",
          144: "36",
          160: "40",
          176: "44",
          192: "48",
          208: "52",
          224: "56",
          240: "60",
          256: "64",
          288: "72",
          320: "80",
          384: "96"
        };
        return scale[px] ?? null;
      }, roundOpacity = function(pct) {
        const steps = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100];
        return steps.reduce((prev, curr) => Math.abs(curr - pct) < Math.abs(prev - pct) ? curr : prev);
      }, parseVariantDescriptor = function(desc) {
        const pairs = {};
        for (const segment of desc.split(",")) {
          const eq = segment.indexOf("=");
          if (eq === -1) continue;
          const key = segment.slice(0, eq).trim();
          const val = segment.slice(eq + 1).trim();
          if (key) pairs[key] = val;
        }
        return pairs;
      }, resolveComponent = function(nodeData) {
        const descriptor = nodeData.figmaComponent || "";
        const parsed = parseVariantDescriptor(descriptor);
        const props = nodeData.props || {};
        if (components[descriptor]) return { ...components[descriptor], _resolvedVia: "exact" };
        for (const resolver of resolvers) {
          let matched = false;
          for (const [field, values] of Object.entries(resolver.match)) {
            const parsedVal = parsed[field];
            if (parsedVal && values.some(
              (v) => v.toLowerCase() === parsedVal.toLowerCase() || v.toLowerCase() === parsedVal.replace(/\*$/, "").toLowerCase()
            )) {
              matched = true;
              break;
            }
          }
          if (!matched) continue;
          if (resolver.detect) {
            const hasDetectField = resolver.detect.some((d) => d in props || d in parsed);
            if (!hasDetectField) continue;
          }
          if (resolver.excludeDetect) {
            const hasExcluded = resolver.excludeDetect.some((d) => d in props);
            if (hasExcluded) continue;
          }
          if (resolver.skip) return { _skip: true };
          const def = {
            componentName: resolver.componentName,
            importPath: resolver.importPath,
            propMap: { ...resolver.propMap },
            defaultProps: { ...resolver.defaultProps },
            leafComponent: resolver.leafComponent || false,
            _resolvedVia: "resolver",
            _wrapperTag: resolver.wrapperTag
          };
          if (resolver.variantToProp) {
            const { field, map } = resolver.variantToProp;
            const variantVal = parsed[field] || props[field];
            if (variantVal && map[variantVal]) {
              def.defaultProps = { ...def.defaultProps, ...map[variantVal] };
            }
          }
          return def;
        }
        for (const key of Object.keys(components)) {
          if (key.toLowerCase().replace(/\s+/g, "") === descriptor.toLowerCase().replace(/\s+/g, "")) {
            return { ...components[key], _resolvedVia: "fuzzy" };
          }
        }
        return null;
      };
      const payload = JSON.parse(payloadStr);
      let manifest = { components: {} };
      const searchPaths = [
        activeProjectRoot ? path__default.join(activeProjectRoot, "bridge-manifest.json") : null,
        path__default.join(app.getPath("home"), "bridge-manifest.json"),
        path__default.join(process.cwd(), "bridge-manifest.json"),
        path__default.join(app.getAppPath(), "bridge-manifest.json"),
        path__default.join(app.getAppPath(), "..", "bridge-manifest.json")
      ].filter(Boolean);
      console.log("[HydroPaste] activeProjectRoot:", activeProjectRoot);
      console.log("[HydroPaste] Searching for manifest in:", searchPaths);
      let manifestLoaded = false;
      for (const manifestPath of searchPaths) {
        try {
          const raw = await readFile(manifestPath, "utf8");
          manifest = JSON.parse(raw);
          console.log(`[HydroPaste] Loaded manifest from ${manifestPath}`);
          manifestLoaded = true;
          break;
        } catch {
        }
      }
      if (!manifestLoaded) {
        console.warn("[HydroPaste] No bridge-manifest.json found in any search path");
        return { error: `Manifest not found. Searched: ${searchPaths.join(", ")}. activeProjectRoot=${activeProjectRoot}` };
      }
      const components = manifest.components || {};
      const resolvers = manifest.resolvers || [];
      const requiredImports = /* @__PURE__ */ new Set();
      async function generateJsxElement(nodeData) {
        const t = await import("@babel/types");
        if (nodeData.figmaComponent === "_TextNode") {
          const text = nodeData.props?.content || "";
          if (!text) return null;
          const twClass2 = stylesToTailwind(nodeData.styles);
          if (twClass2) {
            const attrs = [t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(twClass2))];
            const opening2 = t.jsxOpeningElement(t.jsxIdentifier("span"), attrs, false);
            const closing2 = t.jsxClosingElement(t.jsxIdentifier("span"));
            return { element: t.jsxElement(opening2, closing2, [t.jsxText(text)]), name: "_TextNode" };
          }
          return { element: t.jsxText(text), name: "_TextNode" };
        }
        if (nodeData.figmaComponent === "_Frame") {
          const childNodes2 = [];
          if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
              const generated = await generateJsxElement(child);
              if (generated) childNodes2.push(generated);
            }
          }
          if (childNodes2.length === 0 && !nodeData.styles) return null;
          const twClass2 = stylesToTailwind(nodeData.styles);
          const attrs = twClass2 ? [t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(twClass2))] : [];
          const opening2 = t.jsxOpeningElement(t.jsxIdentifier("div"), attrs, childNodes2.length === 0);
          const closing2 = childNodes2.length === 0 ? null : t.jsxClosingElement(t.jsxIdentifier("div"));
          return { element: t.jsxElement(opening2, closing2, childNodes2.map((c) => c.element)), name: "div" };
        }
        const componentDef = resolveComponent(nodeData);
        if (componentDef?._skip) return null;
        if (componentDef?._wrapperTag || !componentDef && nodeData.children?.length > 0) {
          const tag = componentDef?._wrapperTag || "div";
          const childNodes2 = [];
          if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
              const generated = await generateJsxElement(child);
              if (generated) childNodes2.push(generated);
            }
          }
          if (childNodes2.length === 0) return null;
          const twClass2 = stylesToTailwind(nodeData.styles);
          const attrs = twClass2 ? [t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(twClass2))] : [];
          const opening2 = t.jsxOpeningElement(t.jsxIdentifier(tag), attrs, false);
          const closing2 = t.jsxClosingElement(t.jsxIdentifier(tag));
          return { element: t.jsxElement(opening2, closing2, childNodes2.map((c) => c.element)), name: tag };
        }
        if (!componentDef || !componentDef.importPath) {
          console.warn(`[HydroPaste] Unresolved: "${nodeData.figmaComponent}"`);
          return null;
        }
        console.log(`[HydroPaste] Resolved "${nodeData.figmaComponent}" → ${componentDef.componentName} (via ${componentDef._resolvedVia})`);
        const elementImport = `import { ${componentDef.componentName} } from '${componentDef.importPath}'`;
        requiredImports.add(elementImport);
        const jsxName = t.jsxIdentifier(componentDef.componentName);
        const attributes = [];
        let childNodes = [];
        let textContent = "";
        if (componentDef.defaultProps) {
          for (const [propName, value] of Object.entries(componentDef.defaultProps)) {
            if (propName === "children") {
              textContent = String(value);
              continue;
            }
            if (typeof value === "boolean") {
              if (value) {
                attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), null));
              } else {
                attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(t.booleanLiteral(false))));
              }
            } else if (typeof value === "number") {
              attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(t.numericLiteral(value))));
            } else {
              attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.stringLiteral(String(value))));
            }
          }
        }
        if (nodeData.props) {
          for (const [figmaProp, value] of Object.entries(nodeData.props)) {
            const reactProp = componentDef.propMap[figmaProp];
            if (!reactProp) continue;
            if (reactProp === "children") {
              textContent = String(value);
              continue;
            }
            let attrValue = t.stringLiteral(String(value));
            if (value === "true") attrValue = null;
            if (value === "false") {
              attrValue = t.jsxExpressionContainer(t.booleanLiteral(false));
            }
            if (!isNaN(Number(value)) && value !== "") {
              attrValue = t.jsxExpressionContainer(t.numericLiteral(Number(value)));
            }
            attributes.push(t.jsxAttribute(t.jsxIdentifier(reactProp), attrValue));
          }
        }
        const twClass = stylesToTailwind(nodeData.styles);
        if (twClass) {
          attributes.push(t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(twClass)));
        }
        if (!componentDef.leafComponent && nodeData.children && Array.isArray(nodeData.children)) {
          for (const child of nodeData.children) {
            const generated = await generateJsxElement(child);
            if (generated) childNodes.push(generated);
          }
        }
        const opening = t.jsxOpeningElement(jsxName, attributes, childNodes.length === 0 && !textContent);
        const closing = childNodes.length === 0 && !textContent ? null : t.jsxClosingElement(jsxName);
        const childrenBlock = childNodes.map((c) => c.element);
        if (textContent) {
          childrenBlock.unshift(t.jsxText(textContent));
        }
        return { element: t.jsxElement(opening, closing, childrenBlock), name: componentDef.componentName, import: elementImport };
      }
      const rawElements = await Promise.all(payload.children.map(generateJsxElement));
      const rootElements = rawElements.filter(Boolean);
      if (rootElements.length === 0) return { error: "No valid components found in payload" };
      const _genMod = await import("@babel/generator");
      const generate = typeof _genMod === "function" ? _genMod : typeof _genMod.default === "function" ? _genMod.default : typeof _genMod.default?.default === "function" ? _genMod.default.default : _genMod.generate;
      const elements = rootElements.map((result) => {
        const { code } = generate(result.element);
        return {
          code,
          import: result.import || null
        };
      });
      return {
        ok: true,
        imports: Array.from(requiredImports),
        elements
      };
    } catch (err) {
      console.error("[HydroPaste Error]", err);
      return { error: String(err) };
    }
  });
  ipcMain.handle("ai:query-rag", async (_event, query) => {
    if (typeof query !== "string") return [];
    const { queryRAG } = await import("./ragService-ffskKj_m.js");
    return await queryRAG(query);
  });
  ipcMain.handle("ai:ingest-rag", async (_event, chunks) => {
    if (!Array.isArray(chunks)) return { ingested: 0 };
    const { ingestChunks } = await import("./ragService-ffskKj_m.js");
    return await ingestChunks(chunks);
  });
  ipcMain.handle("ai:clear-rag", async () => {
    const { clearRAG } = await import("./ragService-ffskKj_m.js");
    clearRAG();
  });
  ipcMain.handle("ai:rag-count", async () => {
    const { ragChunkCount } = await import("./ragService-ffskKj_m.js");
    return ragChunkCount();
  });
  let ptyProcess = null;
  ipcMain.handle("terminal:spawn", (event, cwd) => {
    if (typeof cwd !== "string") return;
    const shell = process.env[os.platform() === "win32" ? "COMSPEC" : "SHELL"] || (os.platform() === "win32" ? "cmd.exe" : "bash");
    if (ptyProcess) {
      ptyProcess.kill();
    }
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd,
        env: process.env
      });
      ptyProcess.onData((data) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && !window.isDestroyed()) {
          window.webContents.send("terminal:output", data);
        }
      });
      ptyProcess.onExit(() => {
        ptyProcess = null;
      });
    } catch (err) {
      console.error("[Bridge] terminal:spawn failed", err);
    }
  });
  ipcMain.handle("terminal:data", (_event, data) => {
    if (ptyProcess && typeof data === "string") {
      ptyProcess.write(data);
    }
  });
  ipcMain.handle("terminal:resize", (_event, cols, rows) => {
    if (ptyProcess && typeof cols === "number" && typeof rows === "number") {
      try {
        ptyProcess.resize(cols, rows);
      } catch (err) {
        console.error("[Bridge] terminal:resize failed", err);
      }
    }
  });
  const { startIngestionServer, getServerStatus, stopIngestionServer } = await import("./ingestion-server-TEGQC2iA.js");
  startIngestionServer();
  stopServer = stopIngestionServer;
  ipcMain.handle("server:get-status", () => getServerStatus());
  createWindow();
  buildAppMenu();
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
