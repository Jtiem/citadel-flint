import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("bridgeAPI", {
  /** Health-check: verifies the IPC bridge is functional */
  ping: () => ipcRenderer.invoke("ping"),
  /**
   * Returns the current status of the local ingestion server.
   * The React frontend can call this to confirm the server is live
   * before instructing the Figma plugin to send payloads.
   */
  getServerStatus: () => ipcRenderer.invoke("server:get-status"),
  /**
   * Design token CRUD — backed by the design_tokens SQLite table.
   * All payloads are plain serialisable objects; no Node.js types cross the bridge.
   */
  tokens: {
    /**
     * Persists a new design token. Returns the auto-generated integer id.
     * Rejects with a UNIQUE constraint error if token_path already exists.
     */
    create: (token) => ipcRenderer.invoke("tokens:create", token),
    /** Returns all tokens ordered alphabetically by token_path. */
    readAll: () => ipcRenderer.invoke("tokens:read-all"),
    /**
     * Updates mutable fields on the token identified by `tokenPath`.
     * Returns `{ changes: 0 }` if the path is not found.
     *
     * `tokenPath` and `updates` are passed as separate IPC args:
     *   ipcRenderer.invoke('tokens:update', tokenPath, updates)
     */
    update: (tokenPath, updates) => ipcRenderer.invoke("tokens:update", tokenPath, updates),
    /**
     * Deletes the token with the given integer `id`.
     * Returns `{ changes: 0 }` if the id is not found.
     */
    delete: (id) => ipcRenderer.invoke("tokens:delete", id),
    /** Deletes ALL tokens from the database. Returns the number of removed rows. */
    clearAll: () => ipcRenderer.invoke("tokens:clear-all"),
    /**
     * Removes the `component_overrides` row associated with `bridgeId`.
     * Called by the AST deleteNode garbage collector (Phase E) to release
     * export locks after a node is deleted from the source file.
     *
     * Silent no-op if the bridge ID has no override row (idempotent).
     */
    clearOverride: (bridgeId) => ipcRenderer.invoke("tokens:clear-override", bridgeId),
    /**
     * Inserts or replaces a single property row in `component_overrides`
     * for `bridgeId`, keyed by `propertyKey` (e.g. `"style"`, `"textContent"`).
     *
     * Called by PropertiesPanel after every style / textContent commit so
     * the Export Gate (canExport) blocks until all overrides are resolved.
     *
     * The composite key (bridge_id, property_key) is idempotent: calling
     * this multiple times for the same element + property upserts in-place.
     */
    upsertOverride: (bridgeId, propertyKey, propertyValue) => ipcRenderer.invoke("tokens:upsert-override", bridgeId, propertyKey, propertyValue),
    /**
     * Returns all rows in `component_overrides`, ordered by `updated_at` DESC.
     * Used by `ExportModal` to list every bridge ID + property blocking export.
     */
    readOverrides: () => ipcRenderer.invoke("tokens:read-overrides")
  },
  /**
   * Transforms TSX source into preview-ready JS via Babel in the main process.
   * Returns `{ js, error: null }` on success or `{ js: null, error }` on failure.
   * Strips import statements and rewrites `export default` so the result can run
   * inside a srcdoc iframe where React/ReactDOM are loaded as UMD globals.
   */
  transformCode: (code) => ipcRenderer.invoke("code:transform", code),
  /**
   * Registers a callback that fires whenever the ingestion server writes new
   * tokens to the database (i.e. after a successful POST /ingest from the
   * Figma plugin). The renderer uses this to trigger an automatic re-fetch
   * without requiring a full page reload.
   *
   * Call `removeTokensUpdatedListener()` in a cleanup function to avoid
   * accumulating duplicate listeners across React re-renders.
   */
  onTokensUpdated: (callback) => {
    ipcRenderer.on("bridge:tokens-updated", (_event) => callback());
  },
  /** Removes all listeners registered for the 'bridge:tokens-updated' channel. */
  removeTokensUpdatedListener: () => {
    ipcRenderer.removeAllListeners("bridge:tokens-updated");
  },
  /**
   * Subscribes to live design token updates from the SQLite database.
   *
   * On call, immediately invokes `callback` with the current token list so
   * the caller never starts with stale data. Subsequently, every time any
   * token mutation (create / update / delete / clearAll / Figma ingest)
   * commits to the design_tokens table the main process emits
   * 'bridge:tokens-updated', which re-fetches the full list and calls
   * `callback` again.
   *
   * Returns an unsubscribe function. Pass it to `useEffect` cleanup:
   * ```ts
   * useEffect(() => tokenStore.getState().initSync(), [])
   * ```
   */
  watchTokens: (callback) => {
    const onUpdate = () => {
      void ipcRenderer.invoke("tokens:read-all").then(callback);
    };
    ipcRenderer.on("bridge:tokens-updated", onUpdate);
    void ipcRenderer.invoke("tokens:read-all").then(callback);
    return () => {
      ipcRenderer.removeListener("bridge:tokens-updated", onUpdate);
    };
  },
  /**
   * UPSERTs the local user's presence record (cursor position + selected node).
   *
   * The renderer is responsible for throttling calls to ≤ 1 per 50–100 ms.
   * The main process performs a single UPSERT into the `presence` table on
   * each invocation — no additional main-process batching is applied.
   *
   * @param payload.id     — Session UUID uniquely identifying this user's row.
   * @param payload.userId — Display name or generated handle for the UI.
   * @param payload.nodeId — bridge ID of the currently selected layer (or '').
   * @param payload.x      — Cursor X coordinate in canvas space.
   * @param payload.y      — Cursor Y coordinate in canvas space.
   */
  syncPresence: (payload) => ipcRenderer.invoke("sync:update-presence", payload),
  /**
   * Returns all presence rows whose `updated_at` timestamp is within the
   * last 30 seconds. The renderer polls this at ~5 Hz to refresh the
   * remote-cursor overlay. Rows for the local session are filtered out
   * client-side using the stable `presenceSessionId` from PresenceService.
   */
  readPresence: () => ipcRenderer.invoke("sync:read-presence"),
  /**
   * Atomically writes `content` to the file at `filePath` via the
   * main-process FileTransactionManager.
   *
   * The write is two-phase: content is staged to `<filePath>.tmp` first,
   * then `fs.rename()` overwrites the target atomically. Rapid-fire writes
   * to the same path are serialised; writes to different paths are concurrent.
   *
   * Security: the main process rejects paths outside the user's home directory
   * and paths that do not end with .tsx/.ts/.jsx/.js.
   */
  saveFile: (filePath, content) => ipcRenderer.invoke("ast:save-file", filePath, content),
  /**
   * Atomically writes every `(filePath, content)` pair in `batch` via the
   * main-process FileTransactionManager. Each path undergoes the same security
   * validation as `saveFile`. Writes to different paths proceed concurrently;
   * writes to the same path are serialised in FIFO order.
   *
   * `batch` is a plain object so it serialises cleanly across the IPC boundary.
   *
   * Security: the main process rejects any path that is outside the user's
   * home directory or does not end with .tsx/.ts/.jsx/.js.
   */
  saveFileBatch: (batch) => ipcRenderer.invoke("ast:save-batch", batch),
  /**
   * Shows the native OS directory picker and returns a recursive FileTreeNode
   * tree rooted at the chosen directory. Only `.tsx/.ts/.jsx/.js` files are
   * included; `node_modules`, `dist`, hidden directories, etc. are excluded.
   *
   * Returns null if the user cancels the picker.
   */
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  /**
   * Shows the native OS directory picker and returns only the selected path
   * string — no file scan. Used by the "New Project" flow to pick an empty
   * target directory before calling `project.initialize`.
   *
   * Returns null if the user cancels or selects outside their home directory.
   */
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  /**
   * Project Registry API — backed by the global `bridge-registry.db`.
   * Tracks recently opened / created Bridge workspaces.
   */
  registry: {
    /** Returns up to 10 recently opened projects, newest first. */
    getRecent: () => ipcRenderer.invoke("registry:getRecent"),
    /**
     * Records or refreshes a project entry (upsert on `path`).
     * Call after `openFolder` so manually opened folders appear in the list.
     */
    upsertProject: (payload) => ipcRenderer.invoke("registry:upsertProject", payload),
    /**
     * Removes the project with the given `id` from the registry.
     * Called when the user dismisses a project from the Recent list.
     */
    removeProject: (id) => ipcRenderer.invoke("registry:removeProject", id)
  },
  /**
   * Project lifecycle API — template scaffolding and path-based open.
   */
  project: {
    /**
     * Scaffolds a new Bridge workspace by copying a bundled template into
     * an empty user-selected directory, upserts into the registry, and
     * returns the scanned FileTreeNode tree.
     *
     * Throws if `targetPath` is non-empty, outside the home dir, or if
     * `templateId` is unknown.
     */
    initialize: (payload) => ipcRenderer.invoke("project:initialize", payload),
    /**
     * Opens an existing project by its absolute path: scans for source
     * files, upserts into the registry, and returns the FileTreeNode tree.
     * Returns null when the path is outside the home dir or scan fails.
     */
    openPath: (folderPath) => ipcRenderer.invoke("project:openPath", folderPath)
  },
  /**
   * Reads and returns the raw UTF-8 content of a `.tsx/.ts/.jsx/.js` source
   * file within the user's home directory.
   *
   * The main process enforces the same security constraints as `saveFile`:
   * absolute path, correct extension, inside the user's home directory.
   */
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  /**
   * Returns the raw source content of `filePath` at `commitHash` by running
   * `git show <commitHash>:<relPath>` in the main process.
   *
   * Returns null when the commit or file does not exist in git history, when
   * `filePath` is outside the user's home directory, or when `commitHash` is
   * not a valid hex SHA.
   *
   * Does NOT modify the working tree.
   */
  gitShow: (filePath, commitHash) => ipcRenderer.invoke("ast:git-show", filePath, commitHash),
  /**
   * Returns a chronological list of up to 50 shadow commits that have touched
   * `filePath` in the local git repository. Each entry exposes the abbreviated
   * hash, the commit message, and a Unix timestamp (seconds since epoch).
   *
   * Used by RecoveryPanel to populate the file's Time Machine timeline.
   *
   * Returns an empty array when the file is not tracked by git or the repo
   * does not exist yet.
   */
  gitLog: (filePath) => ipcRenderer.invoke("ast:git-log", filePath),
  /**
   * Native OS menu event subscriptions.
   * The main process pushes these events when the user selects a File menu item.
   * Call `removeMenuListeners()` in a useEffect cleanup to avoid duplicate handlers.
   */
  menu: {
    onNewProject: (callback) => {
      ipcRenderer.on("menu:new-project", () => callback());
    },
    onOpenProject: (callback) => {
      ipcRenderer.on("menu:open-project", () => callback());
    },
    onCloseProject: (callback) => {
      ipcRenderer.on("menu:close-project", () => callback());
    },
    removeMenuListeners: () => {
      ipcRenderer.removeAllListeners("menu:new-project");
      ipcRenderer.removeAllListeners("menu:open-project");
      ipcRenderer.removeAllListeners("menu:close-project");
    }
  }
});
