import { contextBridge, ipcRenderer } from 'electron'
import { BRAND, ipcChannel } from '../shared/brand.ts'

/**
 * The Preload Flint — all communication between the React Renderer
 * and the Node.js Main Process MUST go through this explicit API.
 *
 * Exposed globally as `window.flintAPI`.
 */
contextBridge.exposeInMainWorld(BRAND.apiName, {
    /** Health-check: verifies the IPC flint is functional */
    ping: (): Promise<string> => ipcRenderer.invoke('ping'),

    /**
     * Returns the current status of the local ingestion server.
     * The React frontend can call this to confirm the server is live
     * before instructing the Figma plugin to send payloads.
     */
    getServerStatus: (): Promise<{ running: boolean; port: number }> =>
        ipcRenderer.invoke('server:get-status'),

    /**
     * Figma connection health — aggregates ingestion server state, last sync
     * timestamp, and design token count. Used by StatusBar to drive the
     * staleness indicator (emerald / amber / zinc).
     *
     * Extended (Phase W.3): adds disconnect(), onConnected(), onError(),
     * removeListeners() for the Figma Connect UX Overhaul.
     */
    figma: {
        // SEC.2: `secret` field removed — the per-session secret stays in main process only.
        status: (): Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number }> =>
            ipcRenderer.invoke('figma:status'),

        /**
         * Stops the ingestion server. Idempotent — safe to call when already stopped.
         * The server restarts automatically on the next app launch.
         */
        disconnect: (): Promise<void> =>
            ipcRenderer.invoke('figma:disconnect'),

        /**
         * Subscribes to ipcChannel('figma-connected') push events fired by the
         * ingestion server after each successful POST /ingest.
         * Returns an unsubscribe function for useEffect cleanup.
         */
        onConnected: (callback: (event: { tokenCount: number; timestamp: number }) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: { tokenCount: number; timestamp: number }) => callback(data)
            ipcRenderer.on(ipcChannel('figma-connected'), listener)
            return () => {
                ipcRenderer.removeListener(ipcChannel('figma-connected'), listener)
            }
        },

        /**
         * Subscribes to ipcChannel('figma-error') push events fired by the
         * ingestion server when it rejects a request (401, 400).
         * Returns an unsubscribe function for useEffect cleanup.
         */
        onError: (callback: (event: { statusCode: number; reason: string; timestamp: number }) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: { statusCode: number; reason: string; timestamp: number }) => callback(data)
            ipcRenderer.on(ipcChannel('figma-error'), listener)
            return () => {
                ipcRenderer.removeListener(ipcChannel('figma-error'), listener)
            }
        },

        /**
         * Removes all listeners for figma-connected and figma-error channels.
         * Call in useEffect cleanup if not using the individual unsubscribers.
         */
        removeListeners: (): void => {
            ipcRenderer.removeAllListeners(ipcChannel('figma-connected'))
            ipcRenderer.removeAllListeners(ipcChannel('figma-error'))
        },
    },

    /**
     * Design token CRUD — backed by the design_tokens SQLite table.
     * All payloads are plain serialisable objects; no Node.js types cross the flint.
     */
    tokens: {
        /**
         * Persists a new design token. Returns the auto-generated integer id.
         * Rejects with a UNIQUE constraint error if token_path already exists.
         */
        create: (token: {
            token_path: string
            token_type: string
            token_value: string
            description?: string
        }): Promise<{ id: number }> =>
            ipcRenderer.invoke('tokens:create', token),

        /** Returns all tokens ordered alphabetically by token_path. */
        readAll: (): Promise<{
            id: number
            token_path: string
            token_type: string
            token_value: string
            description: string | null
        }[]> =>
            ipcRenderer.invoke('tokens:read-all'),

        /**
         * Updates mutable fields on the token identified by `tokenPath`.
         * Returns `{ changes: 0 }` if the path is not found.
         *
         * `tokenPath` and `updates` are passed as separate IPC args:
         *   ipcRenderer.invoke('tokens:update', tokenPath, updates)
         */
        update: (
            tokenPath: string,
            updates: {
                token_type?: string
                token_value?: string
                description?: string | null
            }
        ): Promise<{ changes: number }> =>
            ipcRenderer.invoke('tokens:update', tokenPath, updates),

        /**
         * Deletes the token with the given integer `id`.
         * Returns `{ changes: 0 }` if the id is not found.
         */
        delete: (id: number): Promise<{ changes: number }> =>
            ipcRenderer.invoke('tokens:delete', id),

        /** Deletes ALL tokens from the database. Returns the number of removed rows. */
        clearAll: (): Promise<{ changes: number }> =>
            ipcRenderer.invoke('tokens:clear-all'),

        /**
         * Removes the `component_overrides` row associated with `flintId`.
         * Called by the AST deleteNode garbage collector (Phase E) to release
         * export locks after a node is deleted from the source file.
         *
         * Silent no-op if the flint ID has no override row (idempotent).
         */
        clearOverride: (flintId: string): Promise<void> =>
            ipcRenderer.invoke('tokens:clear-override', flintId),

        /**
         * Inserts or replaces a single property row in `component_overrides`
         * for `flintId`, keyed by `propertyKey` (e.g. `"style"`, `"textContent"`).
         *
         * Called by PropertiesPanel after every style / textContent commit so
         * the Export Gate (canExport) blocks until all overrides are resolved.
         *
         * The composite key (flint_id, property_key) is idempotent: calling
         * this multiple times for the same element + property upserts in-place.
         */
        upsertOverride: (
            flintId: string,
            propertyKey: string,
            propertyValue: string,
        ): Promise<void> =>
            ipcRenderer.invoke('tokens:upsert-override', flintId, propertyKey, propertyValue),

        /**
         * Returns all rows in `component_overrides`, ordered by `updated_at` DESC.
         * Used by `ExportModal` to list every flint ID + property blocking export.
         */
        readOverrides: (): Promise<{
            flint_id: string
            property_key: string
            property_value: string
            updated_at: number
        }[]> => ipcRenderer.invoke('tokens:read-overrides'),
    },

    /**
     * Transforms TSX source into preview-ready JS via Babel in the main process.
     * Returns `{ js, error: null }` on success or `{ js: null, error }` on failure.
     * Strips import statements and rewrites `export default` so the result can run
     * inside a srcdoc iframe where React/ReactDOM are loaded as UMD globals.
     */
    transformCode: (code: string): Promise<{ js: string | null; error: string | null }> =>
        ipcRenderer.invoke('code:transform', code),

    /**
     * Registers a callback that fires whenever the ingestion server writes new
     * tokens to the database (i.e. after a successful POST /ingest from the
     * Figma plugin). The renderer uses this to trigger an automatic re-fetch
     * without requiring a full page reload.
     *
     * Call `removeTokensUpdatedListener()` in a cleanup function to avoid
     * accumulating duplicate listeners across React re-renders.
     */
    onTokensUpdated: (callback: () => void): void => {
        ipcRenderer.on(ipcChannel('tokens-updated'), (_event) => callback())
    },

    /** Removes all listeners registered for the ipcChannel('tokens-updated') channel. */
    removeTokensUpdatedListener: (): void => {
        ipcRenderer.removeAllListeners(ipcChannel('tokens-updated'))
    },

    /**
     * Subscribes to live design token updates from the SQLite database.
     *
     * On call, immediately invokes `callback` with the current token list so
     * the caller never starts with stale data. Subsequently, every time any
     * token mutation (create / update / delete / clearAll / Figma ingest)
     * commits to the design_tokens table the main process emits
     * ipcChannel('tokens-updated'), which re-fetches the full list and calls
     * `callback` again.
     *
     * Returns an unsubscribe function. Pass it to `useEffect` cleanup:
     * ```ts
     * useEffect(() => tokenStore.getState().initSync(), [])
     * ```
     */
    watchTokens: (callback: (tokens: {
        id: number
        token_path: string
        token_type: string
        token_value: string
        description: string | null
        mode: string
        collection_name: string
    }[]) => void): (() => void) => {
        const onUpdate = (): void => {
            void ipcRenderer.invoke('tokens:read-all').then(callback)
        }
        ipcRenderer.on(ipcChannel('tokens-updated'), onUpdate)
        // Deliver current state immediately so the caller is never empty on start.
        void ipcRenderer.invoke('tokens:read-all').then(callback)
        return (): void => {
            ipcRenderer.removeListener(ipcChannel('tokens-updated'), onUpdate)
        }
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
     * @param payload.nodeId — flint ID of the currently selected layer (or '').
     * @param payload.x      — Cursor X coordinate in canvas space.
     * @param payload.y      — Cursor Y coordinate in canvas space.
     */
    syncPresence: (payload: {
        id: string
        userId: string
        nodeId?: string
        x: number
        y: number
    }): Promise<void> => ipcRenderer.invoke('sync:update-presence', payload),

    /**
     * Returns all presence rows whose `updated_at` timestamp is within the
     * last 30 seconds. The renderer polls this at ~5 Hz to refresh the
     * remote-cursor overlay. Rows for the local session are filtered out
     * client-side using the stable `presenceSessionId` from PresenceService.
     */
    readPresence: (): Promise<{
        id: string
        user_id: string
        node_id: string
        x: number
        y: number
        updated_at: number
    }[]> => ipcRenderer.invoke('sync:read-presence'),

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
    saveFile: (filePath: string, content: string): Promise<void> =>
        ipcRenderer.invoke('ast:save-file', filePath, content),

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
    saveFileBatch: (batch: Record<string, string>): Promise<void> =>
        ipcRenderer.invoke('ast:save-batch', batch),

    /**
     * Shows the native OS directory picker and returns a recursive FileTreeNode
     * tree rooted at the chosen directory. Only `.tsx/.ts/.jsx/.js` files are
     * included; `node_modules`, `dist`, hidden directories, etc. are excluded.
     *
     * Returns null if the user cancels the picker.
     */
    openFolder: (): Promise<{
        name: string; path: string; type: 'file' | 'directory'
        children?: unknown[]
    } | null> =>
        ipcRenderer.invoke('dialog:openFolder'),

    /**
     * Shows the native OS directory picker and returns only the selected path
     * string — no file scan. Used by the "New Project" flow to pick an empty
     * target directory before calling `project.initialize`.
     *
     * Returns null if the user cancels or selects outside their home directory.
     */
    selectFolder: (): Promise<string | null> =>
        ipcRenderer.invoke('dialog:selectFolder'),

    /**
     * Project Registry API — backed by the global `flint-registry.db`.
     * Tracks recently opened / created Flint workspaces.
     */
    registry: {
        /** Returns up to 10 recently opened projects, newest first. */
        getRecent: (): Promise<{
            id: string; name: string; path: string; last_opened: number
        }[]> =>
            ipcRenderer.invoke('registry:getRecent'),

        /**
         * Records or refreshes a project entry (upsert on `path`).
         * Call after `openFolder` so manually opened folders appear in the list.
         */
        upsertProject: (payload: { name: string; path: string }): Promise<void> =>
            ipcRenderer.invoke('registry:upsertProject', payload),

        /**
         * Removes the project with the given `id` from the registry.
         * Called when the user dismisses a project from the Recent list.
         */
        removeProject: (id: string): Promise<void> =>
            ipcRenderer.invoke('registry:removeProject', id),
    },

    /**
     * Session restoration API.
     * Used by App.tsx to auto-resume the last project on launch.
     */
    session: {
        getLastSession: (): Promise<{ path: string; name: string; isScratchpad: boolean } | null> =>
            ipcRenderer.invoke('project:get-last-session'),
    },

    /**
     * Project lifecycle API — template scaffolding and path-based open.
     */
    project: {
        /**
         * Scaffolds a new Flint workspace by copying a bundled template into
         * an empty user-selected directory, upserts into the registry, and
         * returns the scanned FileTreeNode tree.
         *
         * Throws if `targetPath` is non-empty, outside the home dir, or if
         * `templateId` is unknown.
         */
        initialize: (payload: { targetPath: string; templateId: string }): Promise<{
            name: string; path: string; type: 'file' | 'directory'; children?: unknown[]
        }> =>
            ipcRenderer.invoke('project:initialize', payload),

        /**
         * Opens an existing project by its absolute path: scans for source
         * files, upserts into the registry, and returns the FileTreeNode tree.
         * Returns null when the path is outside the home dir or scan fails.
         */
        openPath: (folderPath: string): Promise<{
            name: string; path: string; type: 'file' | 'directory'; children?: unknown[]
        } | null> =>
            ipcRenderer.invoke('project:openPath', folderPath),

        /**
         * Resets an existing project to the known-good 'flint-demo' state.
         * Overwrites existing files within targetPath.
         */
        resetToDemo: (targetPath: string): Promise<{
            name: string; path: string; type: 'file' | 'directory'; children?: unknown[]
        }> =>
            ipcRenderer.invoke('project:reset-to-demo', targetPath),

        /**
         * Instantly scaffolds a new project in ~/Flint Projects/Untitled-N
         * with no folder picker dialog. Returns the FileTreeNode tree rooted
         * at the new project directory.
         */
        createScratchpad: (): Promise<{
            name: string; path: string; type: 'file' | 'directory'; children?: unknown[]
        }> =>
            ipcRenderer.invoke('project:create-scratchpad'),

        /**
         * CK.3: Re-scans the active project for React components, merges the
         * result into flint-manifest.json, and re-seeds the RAG store.
         *
         * Returns { components, ragChunks } — both zero when no project is open.
         */
        reindex: (): Promise<{ components: number; ragChunks: number }> =>
            ipcRenderer.invoke('project:reindex'),
    },

    /**
     * Reads and returns the raw UTF-8 content of a `.tsx/.ts/.jsx/.js` source
     * file within the user's home directory.
     *
     * The main process enforces the same security constraints as `saveFile`:
     * absolute path, correct extension, inside the user's home directory.
     */
    readFile: (filePath: string): Promise<string> =>
        ipcRenderer.invoke('file:read', filePath),

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
    gitShow: (filePath: string, commitHash: string): Promise<string | null> =>
        ipcRenderer.invoke('ast:git-show', filePath, commitHash),

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
    gitLog: (filePath: string): Promise<{ hash: string; message: string; timestamp: number }[]> =>
        ipcRenderer.invoke('ast:git-log', filePath),

    /**
     * Native OS menu event subscriptions.
     * The main process pushes these events when the user selects a File menu item.
     * Call `removeMenuListeners()` in a useEffect cleanup to avoid duplicate handlers.
     */
    menu: {
        onNewProject: (callback: () => void): void => {
            ipcRenderer.on('menu:new-project', () => callback())
        },
        onOpenProject: (callback: () => void): void => {
            ipcRenderer.on('menu:open-project', () => callback())
        },
        onCloseProject: (callback: () => void): void => {
            ipcRenderer.on('menu:close-project', () => callback())
        },
        onSaveProjectAs: (callback: () => void): void => {
            ipcRenderer.on('menu:save-project-as', () => callback())
        },
        onResetState: (callback: () => void): void => {
            ipcRenderer.on('menu:reset-state', () => callback())
        },
        removeMenuListeners: (): void => {
            ipcRenderer.removeAllListeners('menu:new-project')
            ipcRenderer.removeAllListeners('menu:open-project')
            ipcRenderer.removeAllListeners('menu:close-project')
            ipcRenderer.removeAllListeners('menu:save-project-as')
            ipcRenderer.removeAllListeners('menu:reset-state')
        },
    },

    // ── Phase L: AI Orchestration Engine ──────────────────────────────────────

    /**
     * Applies an array of AI-proposed AST mutations. The actual AST surgery is
     * handled in the renderer (editorStore.applyBatch). This IPC hop provides a
     * uniform surface so the orchestratorStore can trigger mutations identically
     * to drag-and-drop or property panel edits.
     */
    applyBatch: (_mutations: unknown[]): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke('ai:apply-batch'),

    /**
     * AI Orchestration API.
     * All LLM calls run in the main process; chunks stream back via ipcRenderer.on.
     */
    ai: {
        /**
         * Initiates a chat turn. The main process calls Anthropic and forwards
         * streamed chunks back as 'ai:chunk' events. Listen via ai.onChunk().
         */
        chat: (messages: unknown[], context: unknown): Promise<void> =>
            ipcRenderer.invoke('ai:chat', messages, context),

        /** Subscribe to streamed OrchestratorChunk events from the current turn. */
        onChunk: (callback: (chunk: unknown) => void): void => {
            ipcRenderer.on('ai:chunk', (_event, chunk: unknown) => callback(chunk))
        },

        /** Remove all 'ai:chunk' listeners (call in useEffect cleanup). */
        removeChunkListener: (): void => {
            ipcRenderer.removeAllListeners('ai:chunk')
        },

        /** Returns { hasKey, provider, model, baseURL } so the UI can show a config prompt. */
        getConfig: (): Promise<{ hasKey: boolean; provider: string; model: string | null; baseURL: string | null }> =>
            ipcRenderer.invoke('ai:get-config'),

        /** Persist the full AI config (API key, provider, model, baseURL) to ~/.flint/config.json. */
        saveConfig: (config: { apiKey?: string; provider: string; model?: string; baseURL?: string }): Promise<void> =>
            ipcRenderer.invoke('ai:save-config', config),

        // ── Phase N: Figma-to-Flint AST Hydration ─────────────────────────
        /** Sends a Figma component JSON clipboard payload to be converted into an AST React String payload. */
        hydroPaste: (payloadStr: string): Promise<{ ok?: boolean; imports?: string[]; codeSnippets?: string[]; error?: string }> =>
            ipcRenderer.invoke(ipcChannel('hydro-paste'), payloadStr),

        /** Listen for automatic hydro-paste events pushed from the ingestion server. Returns unsubscribe fn. */
        onHydroPasteAuto: (callback: (payload: string) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, payload: string) => callback(payload)
            ipcRenderer.on(ipcChannel('hydro-paste-auto'), listener)
            return () => {
                ipcRenderer.removeListener(ipcChannel('hydro-paste-auto'), listener)
            }
        },

        // ── Phase M: RAG endpoints ───────────────────────────────────────────
        /** Semantic search over the design system knowledge base. */
        queryRAG: (query: string): Promise<unknown[]> =>
            ipcRenderer.invoke('ai:query-rag', query),
        /** Ingest text chunks into the RAG vector store. */
        ingestRAG: (chunks: Array<{ content: string; source?: string; chunkType?: string }>): Promise<{ ingested: number }> =>
            ipcRenderer.invoke('ai:ingest-rag', chunks),
        /** Clear all RAG data for re-ingestion. */
        clearRAG: (): Promise<void> =>
            ipcRenderer.invoke('ai:clear-rag'),
        /** Return the current chunk count in the RAG store. */
        ragCount: (): Promise<number> =>
            ipcRenderer.invoke('ai:rag-count'),
        /** CK.1: Re-seed the RAG store from the active project's manifest, tokens, and docs. */
        seedRAG: (): Promise<{ ingested: number; sources: string[] }> =>
            ipcRenderer.invoke('ai:seed-rag'),
    },

    // ── Phase N.4: Preview Engine IPC ─────────────────────────────────────────

    /**
     * Preview engine API — drives the programmatic Vite dev server that powers
     * the agnostic Live Preview (Phase N.4). The renderer calls `preview.start()`
     * when a project folder is opened and `preview.stop()` on project close.
     */
    preview: {
        /**
         * Starts (or restarts) a Vite dev server at `projectRoot`.
         * Returns `{ url }` on success or `{ error }` on failure.
         *
         * The URL should be loaded as the iframe `src` in LivePreview.tsx.
         */
        start: (projectRoot: string): Promise<{ url: string } | { error: string }> =>
            ipcRenderer.invoke('preview:start', projectRoot),

        /** Gracefully shuts down the running preview server (idempotent). */
        stop: (): Promise<void> =>
            ipcRenderer.invoke('preview:stop'),

        /** Returns the current preview server URL, or null if not running. */
        getUrl: (): Promise<string | null> =>
            ipcRenderer.invoke('preview:url'),
    },

    // ── Phase COLLAB.4: Annotation IPC surface ────────────────────────────────

    /**
     * Annotation read + resolve API — backed by .flint/annotations.json.
     *
     * readAll()              — Returns all annotations ([] when file missing).
     * resolve(id)            — Marks annotation as resolved; atomic tmp→rename.
     * onChanged(cb)          — Registers a callback for ipcChannel('annotations-changed')
     *                          push events sent by main-process fs.watch.
     * removeChangedListener()— Removes all ipcChannel('annotations-changed') listeners.
     *
     * Call `removeChangedListener()` in useEffect cleanup to prevent accumulating
     * duplicate listeners across React re-renders.
     */
    annotations: {
        readAll: (): Promise<unknown[]> =>
            ipcRenderer.invoke('annotations:read-all'),

        resolve: (id: string): Promise<void> =>
            ipcRenderer.invoke('annotations:resolve', id),

        onChanged: (cb: () => void): void => {
            ipcRenderer.on(ipcChannel('annotations-changed'), () => cb())
        },

        removeChangedListener: (): void => {
            ipcRenderer.removeAllListeners(ipcChannel('annotations-changed'))
        },
    },

    // ── IDE→Glass File Sync ───────────────────────────────────────────────────

    /**
     * Fires when the VS Code extension writes a new active file path to
     * `.flint/ide-active-file.json`. Glass uses this to auto-follow IDE focus.
     */
    onIDEFileSelected: (cb: (filePath: string) => void): void => {
        ipcRenderer.on(ipcChannel('ide-file-selected'), (_event, filePath: string) => cb(filePath))
    },

    removeIDEFileSelectedListener: (): void => {
        ipcRenderer.removeAllListeners(ipcChannel('ide-file-selected'))
    },

    // ── Phase W: MCP Push Channel + Bidirectional Action Flint ───────────────

    /**
     * MCP integration API.
     *
     * callTool(name, args)  — Invoke an MCP tool in the main process via stdio.
     * readResource(uri)      — Read an MCP resource by URI.
     * status()               — Returns { connected: boolean, serverPid: number | null }.
     * onEvent(cb)            — Subscribe to ipcChannel('mcp-event') push events.
     *                          The callback receives MCPEvent[] batched within 500ms.
     * removeEventListener()  — Remove all ipcChannel('mcp-event') listeners.
     *
     * Process boundary law:
     *   renderer → preload → main → mcpClient → stdio → MCP server child process
     */
    mcp: {
        callTool: (name: string, args: Record<string, unknown>): Promise<unknown> =>
            ipcRenderer.invoke('mcp:call-tool', name, args),

        readResource: (uri: string): Promise<unknown> =>
            ipcRenderer.invoke('mcp:read-resource', uri),

        status: (): Promise<{ connected: boolean; serverPid: number | null }> =>
            ipcRenderer.invoke('mcp:status'),

        reconnect: (): Promise<void> =>
            ipcRenderer.invoke('mcp:reconnect'),

        onEvent: (callback: (events: unknown[]) => void): void => {
            ipcRenderer.on(ipcChannel('mcp-event'), (_event, events: unknown[]) => callback(events))
        },

        removeEventListener: (): void => {
            ipcRenderer.removeAllListeners(ipcChannel('mcp-event'))
        },
    },

    // ── Phase ING: Import Summary IPC ────────────────────────────────────────
    /**
     * Import Summary API — surfaces ingestion heal pass results in the renderer.
     * Contract: .flint-context/contracts/ING-IngestionHeal.md §3.1
     */
    importSummary: {
        /**
         * Subscribes to ipcChannel('import-summary') push events (fired after each
         * /ingest-ast heal pass). Returns an unsubscribe fn for useEffect cleanup.
         */
        onSummary: (callback: (summary: unknown) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
            ipcRenderer.on(ipcChannel('import-summary'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('import-summary'), listener) }
        },

        /** Applies a tier-2 snap-to-token fix. Returns { ok, updatedSummary? }. */
        snapToToken: (payload: {
            nodeId: string
            tokenPath: string
            className: string
            originalClass: string
        }): Promise<{ ok: boolean; updatedSummary?: unknown }> =>
            ipcRenderer.invoke('import:snap-to-token', payload),

        /** Reverts all tier-1 heals by restoring the pre-heal code. */
        undoAllHeals: (preHealCode: string): Promise<{ ok: boolean }> =>
            ipcRenderer.invoke('import:undo-all-heals', preHealCode),

        /** Removes all ipcChannel('import-summary') listeners. */
        removeListeners: (): void => {
            ipcRenderer.removeAllListeners(ipcChannel('import-summary'))
        },
    },

    // ── Delta Mode: Baseline API ───────────────────────────────────────────────

    /**
     * Violation baseline API — powers Delta Mode (Gap 6).
     *
     * set(violations)   — Bulk-upserts the current audit results into the
     *                     violation_baselines table so they are treated as
     *                     "known" issues going forward.
     * get(filePath)     — Returns all baseline entries for a given file.
     *                     Used by the renderer to compute the delta.
     * clear()           — Removes all baseline rows (reset).
     * isSet()           — Returns true when any baseline rows exist.
     *
     * All operations execute synchronously in the main process via better-sqlite3.
     * No SQLite in the renderer — process boundary is enforced by contextBridge.
     */
    baseline: {
        set: (violations: Array<{ nodeId: string; ruleId: string; severity: string; filePath: string; value?: string }>): Promise<void> =>
            ipcRenderer.invoke('baseline:set', violations),

        get: (filePath: string): Promise<Array<{
            file_path: string
            node_id: string
            rule_id: string
            severity: string
            snapshot_value: string | null
        }>> =>
            ipcRenderer.invoke('baseline:get', filePath),

        clear: (): Promise<void> =>
            ipcRenderer.invoke('baseline:clear'),

        isSet: (): Promise<boolean> =>
            ipcRenderer.invoke('baseline:is-set'),
    },

    // ── Policy Engine ──────────────────────────────────────────────────────────

    /**
     * Reads the active governance policy (.flint/policy.json) from the project root.
     * Returns the DEFAULT_POLICY when no project is open or file is missing.
     *
     * Used by canvasStore.canExport() and ExportModal to determine which
     * violation categories should block export.
     */
    policy: {
        get: (): Promise<{
            version: number
            mithril: { deltaE_threshold: number; deltaE_critical_threshold: number; mode: string; ignore_patterns: string[] }
            a11y: { level: string; mode: string; disabled_rules: string[] }
            export_gate: { block_on_mithril: boolean; block_on_a11y: boolean; block_on_overrides: boolean }
            baseline: { enabled: boolean }
        }> => ipcRenderer.invoke('policy:get'),
    },

    // ── GOV.1 + GOV.2: Governance Provenance + Override Telemetry ─────────────

    /**
     * Governance telemetry API — rule override recording, override count queries,
     * and compliance summary lookups for GOV.1/GOV.2.
     *
     * recordOverride(payload) — Fire-and-forget write to governance_events table.
     * getOverrideCount()      — Returns the session's override event count.
     * getComplianceSummary()  — Returns provenance-enriched ComplianceSummary.
     * onOverrideRecorded(cb)  — Subscribe to push events after each override write.
     *                           Returns an unsubscribe fn for useEffect cleanup.
     *
     * Process boundary law: no fs/sqlite in renderer. All persistence via IPC.
     */
    governance: {
        /**
         * Records a rule override event. Fire-and-forget from the renderer's perspective.
         * Main process writes to governance_events via GovernanceEventService.
         */
        recordOverride: (payload: {
            ruleId: string
            action: 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'
            newValue: { enabled?: boolean; severity?: string } | null
            filePath: string
        }): Promise<void> =>
            ipcRenderer.invoke('governance:record-override', payload),

        /**
         * Returns the count of 'override' events recorded in the current Glass session.
         * Used by StatusBar to populate the "Overrides (N)" badge.
         */
        getOverrideCount: (): Promise<number> =>
            ipcRenderer.invoke('governance:override-count'),

        /**
         * Returns a ComplianceSummary for the given ruleIds by resolving each
         * ruleId against the static provenance registry.
         * Used by ExportModal "Compliance Summary" section.
         */
        getComplianceSummary: (ruleIds: string[]): Promise<unknown> =>
            ipcRenderer.invoke('governance:compliance-summary', ruleIds),

        /**
         * Subscribe to ipcChannel('governance-override-recorded') push events.
         * The main process broadcasts this after each successful governance:record-override.
         * StatusBar uses this to re-fetch the override count without polling.
         *
         * Returns an unsubscribe function — pass it to useEffect cleanup.
         */
        onOverrideRecorded: (cb: () => void): (() => void) => {
            const listener = (): void => cb()
            ipcRenderer.on(ipcChannel('governance-override-recorded'), listener)
            return (): void => {
                ipcRenderer.removeListener(ipcChannel('governance-override-recorded'), listener)
            }
        },
    },

    // ── Phase ACX.5: Context Sync Pipeline ────────────────────────────────────

    /**
     * Writes a FlintContext snapshot to `.flint/context.json` via the main
     * process. Called by `useContextSync` every 200 ms (debounced) so the MCP
     * server always has fresh Glass state available via `flint_get_context`.
     *
     * Fire-and-forget — the renderer does not need the resolved value.
     *
     * Process boundary law: we deliberately do NOT expose `fs` here. The write
     * goes through the main process, which enforces the `.flint/` directory
     * boundary and performs an atomic tmp→rename write.
     */
    syncContext: (context: unknown): Promise<void> =>
        ipcRenderer.invoke('context:sync', context),

    /**
     * Returns an enriched context snapshot assembled from `.flint/context.json`
     * plus live SQLite metrics (token count, active override count).
     *
     * Used by the ACX session-context assembly to pre-populate `flint://session-context`
     * without requiring the MCP server to make additional IPC calls.
     */
    context: {
        getEnriched: (): Promise<unknown> =>
            ipcRenderer.invoke('context:get-enriched'),
    },

    // ── Strategy 7: Deferred Violations ──────────────────────────────────────

    /**
     * Defers a governance violation so the user can return to it in a later
     * session. Upserts by (file, ruleId, nodeId) — deferring the same
     * violation twice just refreshes the timestamp and reason.
     */
    deferViolation: (file: string, ruleId: string, nodeId?: string, reason?: string): Promise<void> =>
        ipcRenderer.invoke('governance:defer-violation', file, ruleId, nodeId, reason),

    /**
     * Returns all unresolved deferred violations (resolved_at IS NULL).
     * Used by GovernanceOverlay to show "Deferred" badges.
     */
    getDeferredViolations: (): Promise<Array<{
        id: number
        file_path: string
        rule_id: string
        node_id: string | null
        reason: string | null
        session_id: string
        deferred_at: string
    }>> =>
        ipcRenderer.invoke('governance:get-deferred-violations'),

    /**
     * Resolves a previously deferred violation by setting its resolved_at
     * timestamp. Called when the violation is fixed or dismissed.
     */
    resolveDeferredViolation: (file: string, ruleId: string, nodeId?: string): Promise<void> =>
        ipcRenderer.invoke('governance:resolve-deferred-violation', file, ruleId, nodeId),

    // ── Beta Distribution IPC ────────────────────────────────────────────────

    /**
     * Beta build API — expiry info, feedback submission, and update notifications.
     *
     * getInfo()                — Returns build ID, expiry date, days remaining.
     * submitFeedback(fb)       — Saves feedback locally + optionally posts to GitHub.
     * onUpdateAvailable(cb)    — Subscribes to 'beta:update-available' push events.
     * onExpiredRemote(cb)      — Subscribes to 'beta:expired-remote' push events.
     * removeListeners()        — Removes all beta push event listeners.
     */
    beta: {
        getInfo: (): Promise<{
            buildId: string
            expiryDate: string | null
            daysRemaining: number | null
            isBeta: boolean
        }> => ipcRenderer.invoke('beta:get-info'),

        submitFeedback: (feedback: {
            category: 'bug' | 'feature' | 'usability' | 'other'
            description: string
            severity: 'cosmetic' | 'annoying' | 'blocker'
            context?: string
        }): Promise<{ saved: boolean }> =>
            ipcRenderer.invoke('beta:submit-feedback', feedback),

        /**
         * Copies the bundled demo project to a temp directory and returns the path.
         * The demo project contains a component with intentional violations and
         * a matching design-tokens.json so testers can experience governance immediately.
         */
        loadDemoProject: (): Promise<{ projectPath: string } | { error: string }> =>
            ipcRenderer.invoke('beta:load-demo-project'),

        onUpdateAvailable: (callback: (event: {
            version: string
            downloadUrl: string
            message: string
        }) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: { version: string; downloadUrl: string; message: string }) => callback(data)
            ipcRenderer.on(ipcChannel('beta:update-available'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('beta:update-available'), listener) }
        },

        onExpiredRemote: (callback: (event: { message: string }) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: { message: string }) => callback(data)
            ipcRenderer.on(ipcChannel('beta:expired-remote'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('beta:expired-remote'), listener) }
        },

        removeListeners: (): void => {
            ipcRenderer.removeAllListeners(ipcChannel('beta:update-available'))
            ipcRenderer.removeAllListeners(ipcChannel('beta:expired-remote'))
        },
    },

    // ── ONBOARD.1: Setup Wizard IPC ──────────────────────────────────────────
    setup: {
        /** Detect which IDEs are installed by checking known settings file paths. */
        detectIDEs: (): Promise<{
            ides: Array<{ name: string; settingsPath: string; detected: boolean }>
            mcpServerPath: string
        }> => ipcRenderer.invoke('setup:detect-ides'),

        /** Check if this is the first launch (no .flint/setup.json with firstLaunchComplete). */
        checkFirstLaunch: (): Promise<{ isFirstLaunch: boolean }> =>
            ipcRenderer.invoke('setup:check-first-launch'),

        /** Write the first-launch-complete flag to ~/.flint/setup.json. */
        completeFirstLaunch: (): Promise<void> =>
            ipcRenderer.invoke('setup:complete-first-launch'),

        /** Auto-write the Flint MCP entry into the IDE's config file. Merges with existing config. */
        writeMCPConfig: (ideName: string, configPath: string, mcpServerPath: string): Promise<{ written: boolean }> =>
            ipcRenderer.invoke('setup:write-mcp-config', ideName, configPath, mcpServerPath),

        /** Delete ~/.flint/setup.json so the next launch shows the full onboarding flow. */
        resetState: (): Promise<void> => ipcRenderer.invoke('app:reset-state'),
    },

    // ── Phase CV2.3: Component Cards on Canvas ────────────────────────────────

    /**
     * Component card IPC surface — reads flint-manifest.json and persists
     * spatial card positions via FileTransactionManager.
     *
     * list()           — Returns ComponentCardData[] for the active project.
     * savePositions()  — Atomically writes .flint/card-positions.json.
     * loadPositions()  — Reads .flint/card-positions.json; returns {} if missing.
     */
    components: {
        /** Returns all indexed components for the active project. */
        list: (): Promise<unknown[]> =>
            ipcRenderer.invoke('components:list'),

        /** Persists card spatial positions to .flint/card-positions.json. */
        savePositions: (positions: Record<string, { x: number; y: number }>): Promise<void> =>
            ipcRenderer.invoke('components:save-positions', positions),

        /** Loads persisted card positions. Returns {} if no file exists. */
        loadPositions: (): Promise<Record<string, { x: number; y: number }>> =>
            ipcRenderer.invoke('components:load-positions'),

        /**
         * CV2.6: Persists a user-defined category override for a component.
         * Writes to .flint/category-overrides.json via FileTransactionManager.
         * The `components:list` handler reads and applies these overrides after
         * auto-derivation from file path convention.
         */
        setCategory: (payload: { componentId: string; category: string }): Promise<void> =>
            ipcRenderer.invoke('components:set-category', payload),
    },

    // ── Phase CV2.2: Component Thumbnail Generator ────────────────────────────

    /**
     * Component thumbnail generation and retrieval (Phase CV2.2).
     *
     * Thumbnails are static PNGs rendered via offscreen BrowserWindow capture,
     * cached in .flint/thumbnails/. All operations are pull-based (no push events).
     *
     * Process boundary law:
     *   renderer → preload → main → ThumbnailGenerator → hidden BrowserWindow
     *
     * Security: componentName is sanitized in the main process before any file I/O.
     */
    thumbnails: {
        /**
         * Generate a thumbnail for a single component file.
         * Returns a cache hit immediately if the PNG exists; otherwise renders.
         */
        generate: (payload: {
            filePath: string
            componentName: string
            width?: number
            height?: number
        }): Promise<{
            componentName: string
            thumbnailPath: string
            generated: boolean
            error: string | null
        }> => ipcRenderer.invoke('thumbnails:generate', payload),

        /**
         * Batch generate thumbnails for all components in flint-manifest.json.
         * Processes sequentially to avoid GPU contention.
         */
        generateAll: (): Promise<{
            total: number
            succeeded: number
            failed: number
            results: Array<{
                componentName: string
                thumbnailPath: string
                generated: boolean
                error: string | null
            }>
        }> => ipcRenderer.invoke('thumbnails:generate-all'),

        /**
         * Read a cached thumbnail as a base64 data URL string.
         * Returns null if not cached — caller should call generate() first.
         */
        get: (componentName: string): Promise<string | null> =>
            ipcRenderer.invoke('thumbnails:get', componentName),

        /**
         * Invalidate (delete) the cached thumbnail for a specific component.
         * Called automatically on ast:save-file; can also be called manually.
         */
        invalidate: (componentName: string): Promise<void> =>
            ipcRenderer.invoke('thumbnails:invalidate', componentName),
    },

    // ── Phase REM.2.1: Governance Autopilot ──────────────────────────────────

    /**
     * Governance Autopilot — watches the active file and broadcasts governed
     * source after each save (500 ms debounce).
     *
     * enable(filePath)   — Start watching `filePath` and run an initial audit.
     * disable()          — Stop watching. Idempotent.
     * onResult(callback) — Subscribe to AutopilotResult push events.
     *                      Returns an unsubscribe fn for useEffect cleanup.
     */
    autopilot: {
        enable: (filePath: string): Promise<void> =>
            ipcRenderer.invoke('autopilot:enable', filePath),

        disable: (): Promise<void> =>
            ipcRenderer.invoke('autopilot:disable'),

        onResult: (callback: (result: {
            filePath: string
            governedSource: string
            fixableCount: number
            mithrilCount: number
            a11yCount: number
            timestamp: number
        }) => void): (() => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                data: {
                    filePath: string
                    governedSource: string
                    fixableCount: number
                    mithrilCount: number
                    a11yCount: number
                    timestamp: number
                }
            ) => callback(data)
            ipcRenderer.on(ipcChannel('autopilot-result'), listener)
            return () => {
                ipcRenderer.removeListener(ipcChannel('autopilot-result'), listener)
            }
        },
    },

    // ── CR.4: Component Scope Management ─────────────────────────────────────
    /**
     * Component scope management API — backed by flint-manifest.json (registry)
     * and .flint/policy.json (componentScope allow-list).
     *
     * getRegistryAndScope() — Returns the full component registry from
     *   flint-manifest.json and the current componentScope from policy.json
     *   in a single round-trip. null scope = all components allowed.
     *
     * setScope(update) — Persists scope changes to .flint/policy.json via
     *   FileTransactionManager (Commandment 12). Pass null to clear restrictions.
     *
     * Process boundary law: no fs in renderer. All I/O via these IPC wrappers.
     */
    scope: {
        /**
         * Returns the full component registry + current scope from policy.json.
         * Single round-trip — renderer never reads the registry and policy separately.
         */
        getRegistryAndScope: (): Promise<unknown> =>
            ipcRenderer.invoke('scope:get-registry-and-scope'),

        /**
         * Persists the updated componentScope to .flint/policy.json.
         * Pass null to clear the scope (all components allowed).
         */
        setScope: (update: { scope: string[] | null }): Promise<{ ok: boolean; error?: string }> =>
            ipcRenderer.invoke('scope:set-scope', update),

        /**
         * LIB.1: Get the currently selected library from policy.json.
         * Returns the library target string or null if none set.
         */
        getActiveLibrary: (): Promise<{ library: string | null; availableLibraries: Array<{ library: string; displayName: string }> }> =>
            ipcRenderer.invoke('library:get-active'),

        /**
         * LIB.1: Set the active component library.
         * Writes selectedLibrary to policy.json and seeds base tokens.
         * Pass null to clear the selection.
         */
        setActiveLibrary: (update: { library: string | null }): Promise<{ ok: boolean; library: string | null; seeded: number; error?: string }> =>
            ipcRenderer.invoke('library:set-active', update),
    },

    // ── EN.1: Enrichment Draft Reading and Approval ───────────────────────────
    /**
     * Enrichment draft management API — backed by .flint/enrichment-drafts.json
     * and flint-manifest.json.
     *
     * getDrafts() — Returns all pending enrichment drafts plus computed stats
     *   (bare / draft / enriched / total component counts). Single round-trip.
     *
     * approve(payload) — Approves or dismisses a single draft. On approve,
     *   the draft fields (with any renderer-side edits) are merged into
     *   flint-manifest.json and the RAG store is re-seeded. On dismiss,
     *   the draft is removed without touching the manifest.
     *
     * Process boundary law: no fs in renderer. All I/O via these IPC wrappers.
     */
    enrichment: {
        /** Returns all pending enrichment drafts + component enrichment stats. */
        getDrafts: (): Promise<unknown> =>
            ipcRenderer.invoke('enrichment:get-drafts'),

        /**
         * Approves or dismisses a single enrichment draft.
         * On 'approve': merges draft into manifest + re-seeds RAG.
         * On 'dismiss': removes draft without touching the manifest.
         * editedFields overrides specific draft fields before merge.
         */
        approve: (payload: {
            componentName: string
            action: 'approve' | 'dismiss'
            editedFields?: Record<string, unknown>
        }): Promise<{ ok: boolean; remainingDrafts: number; error?: string }> =>
            ipcRenderer.invoke('enrichment:approve', payload),
    },

    // ── Phase D2C.2: Design-to-Code LivePreview Integration ──────────────────

    /**
     * Design-to-code apply pipeline — atomically writes all generated component
     * files to disk (with injectFlintIds), shadow-commits the generated directory,
     * re-scans the workspace tree, and returns the page compositor path so the
     * renderer can call canvasStore.setActiveFile() to trigger LivePreview rendering.
     *
     * Implements contract D2C.2 (d2c:apply IPC channel).
     */
    designToCode: {
        apply: (request: {
            pageName: string
            components: Array<{ name: string; code: string }>
            page: { name: string; code: string }
            themeFile?: { filename: string; code: string }
        }): Promise<{
            ok: boolean
            pageFilePath: string
            componentFilePaths: string[]
            workspaceTree: unknown
            error?: string
        }> => ipcRenderer.invoke('d2c:apply', request),
    },

    /**
     * Re-scans the active project directory and returns the updated FileTreeNode.
     * Useful after any operation that creates or deletes files outside the normal
     * save-file flow (D2C apply, template scaffolding, etc.).
     *
     * Returns null when no project is open (activeProjectRoot is null).
     */
    rescanWorkspace: (): Promise<unknown> =>
        ipcRenderer.invoke('workspace:rescan'),
})
