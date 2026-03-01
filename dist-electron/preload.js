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
    upsertOverride: (bridgeId, propertyKey, propertyValue) => ipcRenderer.invoke("tokens:upsert-override", bridgeId, propertyKey, propertyValue)
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
   * Shows the native OS directory picker and returns a recursive FileTreeNode
   * tree rooted at the chosen directory. Only `.tsx/.ts/.jsx/.js` files are
   * included; `node_modules`, `dist`, hidden directories, etc. are excluded.
   *
   * Returns null if the user cancels the picker.
   */
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
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
  gitShow: (filePath, commitHash) => ipcRenderer.invoke("ast:git-show", filePath, commitHash)
});
