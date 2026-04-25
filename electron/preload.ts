import { contextBridge, ipcRenderer } from 'electron'
import { BRAND, ipcChannel } from '../shared/brand.ts'
import { validateIPC, mcpCallToolSchema, validateMcpToolArgs, projectSmartOpenSchema, telemetrySetConsentPayloadSchema, telemetryGetConsentResponseSchema } from '../shared/ipc-validators.ts'

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
         * Reads <projectRoot>/.flint/design-tokens.json (or fallback
         * <projectRoot>/design-tokens.json), flattens DTCG, clears the store, and
         * seeds. Returns { seeded, source, sourcePath?, error? } so the renderer
         * can fall back to baseline tokens when source==='none'.
         */
        seedFromProject: (
            projectRoot: string,
        ): Promise<{ seeded: number; source: 'project' | 'none'; sourcePath?: string; error?: string }> =>
            ipcRenderer.invoke('tokens:seed-from-project', projectRoot),

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

        /**
         * MINT.2a: Scans project files for CSS variable references to design tokens.
         * Returns usage counts per token for dead-token detection and usage badges.
         */
        scanUsage: (): Promise<{
            tokenName: string
            cssVar: string
            usageCount: number
            files: string[]
        }[]> => ipcRenderer.invoke('tokens:scan-usage'),

        /**
         * MINT.3a: Audits color token pairs for WCAG contrast compliance.
         */
        auditContrast: (): Promise<{
            fg: string; bg: string; fgValue: string; bgValue: string
            ratio: number; passAA: boolean; passAAA: boolean
        }[]> => ipcRenderer.invoke('tokens:audit-contrast'),

        /**
         * MINT.3c: Returns pending tokens awaiting approval.
         */
        getPendingApprovals: (): Promise<{
            name: string; value: string; type: string; source: string; proposedAt: string
        }[]> => ipcRenderer.invoke('tokens:get-pending-approvals'),

        /**
         * MINT.3c: Approves a pending token, moving it into design-tokens.json.
         */
        approveToken: (tokenName: string): Promise<{ ok: boolean }> =>
            ipcRenderer.invoke('tokens:approve-token', tokenName),

        /**
         * MINT.3c: Rejects a pending token, removing it from the pending list.
         */
        rejectToken: (tokenName: string): Promise<{ ok: boolean }> =>
            ipcRenderer.invoke('tokens:reject-token', tokenName),

        /**
         * MINT.5: Returns the list of design tokens that differ between the
         * local design_tokens SQLite table and .flint/figma-tokens.json.
         * Computed main-side to avoid the render-loop bug in useTokenUsage.
         * Returns [] when figma-tokens.json is missing or unparseable.
         */
        readFigmaDrift: (): Promise<Array<{
            tokenName: string
            localValue: string
            figmaValue: string
            deltaE?: number
        }>> =>
            ipcRenderer.invoke('tokens:read-figma-drift'),

        /**
         * MINT.5: Subscribes to governance:on-token-approved push events.
         * Fires after a token is approved via Glass UI (source='glass') or MCP
         * tool flint_approve_tokens (source='mcp'). Returns an unsubscribe
         * function for useEffect cleanup.
         */
        onTokenApproved: (
            callback: (event: { tokenName: string; source: 'glass' | 'mcp'; timestamp: number }) => void,
        ): (() => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                data: { tokenName: string; source: 'glass' | 'mcp'; timestamp: number },
            ) => callback(data)
            ipcRenderer.on(ipcChannel('governance:on-token-approved'), listener)
            return () => {
                ipcRenderer.removeListener(ipcChannel('governance:on-token-approved'), listener)
            }
        },
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
     * MFP.2: Compiles a Vue 3 SFC (.vue) source string into preview-ready JS
     * and extracts <style> block CSS. Runs in the main process via @vue/compiler-sfc.
     * Returns { js, css, error: null } on success, { js: null, css: '', error } on failure.
     */
    transformVue: (code: string): Promise<{ js: string | null; css: string; error: string | null }> =>
        ipcRenderer.invoke('code:transform-vue', code),

    /**
     * MFP.3: Compiles a Svelte (.svelte) source string into self-contained vanilla JS
     * and extracts <style> block CSS. Runs in the main process via svelte/compiler.
     * Returns { js, css, error: null } on success, { js: null, css: '', error } on failure.
     */
    transformSvelte: (code: string): Promise<{ js: string | null; css: string; error: string | null }> =>
        ipcRenderer.invoke('code:transform-svelte', code),

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
     * Subscribes to file-change events pushed by the workspace file watcher in
     * the main process. Fires whenever a tracked source file's mtime increases
     * (typically after an AI write or a manual disk save). The renderer uses
     * this to keep LivePreview in sync without polling.
     *
     * Call `removeFileChangedListener()` in cleanup to avoid duplicate
     * listeners across React re-renders.
     */
    onFileChanged: (callback: (data: { filePath: string; content: string }) => void): void => {
        ipcRenderer.on(ipcChannel('file-changed'), (_event, data: { filePath: string; content: string }) => callback(data))
    },

    /** Removes all listeners registered for the file-changed channel. */
    removeFileChangedListener: (): void => {
        ipcRenderer.removeAllListeners(ipcChannel('file-changed'))
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

        /** Walks up the directory tree from filePath to find the project root.
         *  Returns the absolute project root path, or null if not found. */
        findRootForFile: (filePath: string): Promise<string | null> =>
            ipcRenderer.invoke('project:findRootForFile', filePath),

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
        createScratchpad: (payload?: { libraryDefault?: string }): Promise<{
            name: string; path: string; type: 'file' | 'directory'; children?: unknown[]
        }> =>
            ipcRenderer.invoke('project:create-scratchpad', payload),

        /**
         * CK.3: Re-scans the active project for React components, merges the
         * result into flint-manifest.json, and re-seeds the RAG store.
         *
         * Returns { components, ragChunks } — both zero when no project is open.
         */
        reindex: (): Promise<{ components: number; ragChunks: number }> =>
            ipcRenderer.invoke('project:reindex'),

        /**
         * FORGE.2a: Detects the project environment (UI framework, CSS framework,
         * token format, TypeScript, component library). Also writes to
         * .flint/detected-environment.json and runs a baseline audit if MCP is up.
         * Returns null when no project is open.
         */
        detectEnvironment: (): Promise<unknown> =>
            ipcRenderer.invoke('project:detect-environment'),

        /**
         * FORGE.2b: Calls MCP tools to configure the project from the previously
         * detected environment. Reads .flint/detected-environment.json, calls
         * flint_set_library (if a library was detected) and flint_reindex_registry.
         * All MCP calls are best-effort. Returns whether configuration succeeded.
         */
        autoConfigureProject: (payload?: {
            overrides?: {
                framework?: string
                componentLibrary?: string
                cssFramework?: string
            }
        }): Promise<{ configured: boolean; library: string | null; reindexed: boolean }> =>
            ipcRenderer.invoke('project:auto-configure', payload),

        /**
         * FORGE.4b: Reads the cached debt snapshot for a project and returns
         * its health grade letter, numeric score, and last-updated timestamp.
         * Returns null when the snapshot file is missing or malformed.
         */
        getHealthGrade: (projectPath: string): Promise<{ grade: string; score: number; updatedAt: string } | null> =>
            ipcRenderer.invoke('project:get-health-grade', projectPath),

        /**
         * FORGE.2c: Runs a full project-wide audit via flint_swarm_audit_fix,
         * then fetches the debt report via flint_debt_report, and writes the
         * result to .flint/debt-snapshot.json.
         *
         * Progress events are emitted on 'project:baseline-progress' (use
         * `onBaselineProgress` to subscribe). Returns null when no project is
         * open or MCP is not connected.
         */
        runBaseline: (): Promise<{ violations: number; grade: string; score: number; filesAudited: number } | null> =>
            ipcRenderer.invoke('project:run-baseline'),

        /**
         * FORGE.2c: Subscribes to progress events emitted during `runBaseline`.
         * Returns an unsubscribe function for useEffect cleanup.
         */
        onBaselineProgress: (callback: (data: { phase: string; percent: number }) => void): (() => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: { phase: string; percent: number }) => callback(data)
            ipcRenderer.on('project:baseline-progress', listener)
            return () => {
                ipcRenderer.removeListener('project:baseline-progress', listener)
            }
        },

        /**
         * FORGE.1: "Start from existing code" channel.
         *
         * Accepts either an absolute folder path or a git URL (https://, git@, ssh://).
         * The main process heuristic-routes:
         *   - git URL → git clone via GitManager (Commandment 14) → detect
         *   - folder path → detect directly
         *
         * Returns the resolved project path, the detected ProjectEnvironment,
         * and a `source` field indicating which routing path was taken.
         *
         * Payload is validated against `projectSmartOpenSchema` (z.object({ input: z.string().min(1) }))
         * before the IPC call is made.
         */
        smartOpen: (input: string): Promise<{
            projectPath: string
            environment: unknown
            source: 'folder' | 'git-clone'
        }> => {
            projectSmartOpenSchema.parse({ input })
            return ipcRenderer.invoke('project:smart-open', { input })
        },
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
     * Used by future Command Palette Time Machine entry to populate the file's timeline.
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
    onIDEFileSelected: (cb: (data: string | { path: string; explicit?: boolean }) => void): void => {
        ipcRenderer.on(ipcChannel('ide-file-selected'), (_event, data: string | { path: string; explicit?: boolean }) => cb(data))
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
        callTool: (name: string, args: Record<string, unknown>): Promise<unknown> => {
            // MINT.5 Phase 2 consensus FIX-4 (Security WARN-1):
            // Validate the [name, args] tuple against mcpCallToolSchema at the
            // preload bridge — Design by Contract at the process boundary.
            // On validation failure we throw a SANITIZED message (no Zod
            // internals leaked) because the error flows into user-visible
            // toasts via useSyncActions.
            try {
                validateIPC('mcp:call-tool', [name, args], mcpCallToolSchema)
            } catch {
                throw new Error('Invalid MCP tool call — request rejected by the Glass sandbox.')
            }

            // MINT.5 Phase 3 — per-tool argument validation gate (W5 helper).
            // Single source of truth: validateMcpToolArgs() lives in
            // shared/ipc-validators.ts and is consumed identically here and in
            // server/index.ts. On validation failure we short-circuit with the
            // validation-error envelope — ipcRenderer.invoke is NOT called
            // (invariant: validation-gate-zero-network).
            const gateResult = validateMcpToolArgs(name, args)
            if (!gateResult.ok) {
                return Promise.resolve(gateResult.envelope)
            }

            return ipcRenderer.invoke('mcp:call-tool', name, args)
        },

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

        /** Phase 3: Returns the filePath from the most recent file:focus event
         *  within the last 60 seconds across all known projects, or null. */
        getRecentFileFocus: (): Promise<string | null> =>
            ipcRenderer.invoke('mcp:get-recent-file-focus'),
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
            /** CHRON.1-repair M3: optional free-text reason captured via OverrideReasonDialog. */
            reason?: string
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

        /**
         * COUNSEL.1.4: Preview the proposed fix for a violation before applying.
         * Calls flint_fix with dry_run:true via the MCP engine and returns the
         * normalised InlineFixPreview shape for GovernanceDashboard inline diffs.
         *
         * Returns null when the MCP server is disconnected, the file cannot be
         * parsed, or no fixable violations are found for the given ruleId.
         */
        previewFix: (ruleId: string, filePath: string): Promise<{
            current: string
            proposed: string
            tokenName: string
            isColor: boolean
        } | null> =>
            ipcRenderer.invoke('governance:preview-fix', ruleId, filePath),

        /**
         * Apply all Mithril + A11y auto-fixes to a file and write to disk.
         * Used by GovernanceDashboard "Fix all" — bypasses the renderer MCP
         * allowlist; the main process owns the write path.
         */
        applyFix: (filePath: string): Promise<{ fixesApplied: number; status: string } | null> =>
            ipcRenderer.invoke('governance:apply-fix', filePath),

        /**
         * COUNSEL.2.1: Defer a violation for later resolution.
         * Canonical location — callers should prefer governance.deferViolation.
         */
        deferViolation: (opts: { filePath: string; ruleId: string; nodeId?: string; reason?: string; duration?: string }): Promise<void> =>
            ipcRenderer.invoke('governance:defer-violation', opts.filePath, opts.ruleId, opts.nodeId, opts.reason, opts.duration),

        /**
         * Returns all unresolved deferred violations (resolved_at IS NULL).
         */
        getDeferredViolations: (): Promise<Array<{
            id: number
            file_path: string
            rule_id: string
            node_id: string | null
            reason: string | null
            duration: string | null
            expires_at: string | null
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

        /**
         * COUNSEL.3.2: Returns provenance info for all mutations on a given file.
         * Maps nodeId → { source, agentId?, timestamp } for "Introduced by" chips.
         * Returns empty object when the mutations_ledger table is not available.
         */
        getProvenanceSummary: (filePath: string): Promise<Record<string, { source: string; agentId?: string; timestamp: string }>> =>
            ipcRenderer.invoke('governance:get-provenance-summary', filePath),

        /**
         * COUNSEL.3.3: Returns recent anomalies from the Flare engine (last 24h).
         * Returns empty array when the anomaly_history table is not available.
         */
        getAnomalies: (): Promise<Array<{ type: string; severity: string; message: string; detected_at: string }>> =>
            ipcRenderer.invoke('governance:get-anomalies'),

        /**
         * COUNSEL.3.1: Returns the most recent health-history entry with score >= 95.
         * Returns null when no clean state exists. Used by "Rewind to clean" link.
         */
        getLastCleanState: (): Promise<{ timestamp: string; score: number } | null> =>
            ipcRenderer.invoke('governance:get-last-clean-state'),

        /**
         * COUNSEL.4.1: Previews the impact of changing a design token.
         * Returns affected file count and impact classification.
         */
        previewTokenImpact: (tokenName: string, newValue: string): Promise<{
            affectedFiles: number
            estimatedImpact: 'low' | 'medium' | 'high'
        }> =>
            ipcRenderer.invoke('governance:preview-token-impact', tokenName, newValue),

        /**
         * COUNSEL.4.2: Returns health score history for the compliance trajectory chart.
         */
        getHealthHistory: (): Promise<Array<{ date: string; score: number; grade: string }>> =>
            ipcRenderer.invoke('governance:get-health-history'),

        /**
         * COUNSEL.4.2: Records a health score entry to the history file.
         * Called after each audit to build the trajectory chart.
         */
        recordHealth: (entry: { score: number; grade: string }): Promise<void> =>
            ipcRenderer.invoke('governance:record-health', entry),

        /**
         * S8.3: Returns pending mutations awaiting approval (Amber/Red risk tier).
         */
        getPendingMutations: (): Promise<Array<{
            id: number; type: string; filePath: string; riskScore: number; riskTier: string; agentId?: string
        }>> =>
            ipcRenderer.invoke('governance:get-pending-mutations'),

        /**
         * S8.3: Approves a pending mutation by setting approved_at.
         * CHRON.1: reason is forwarded to the main process and written to justification column.
         */
        approveMutation: (id: number, reason?: string): Promise<void> =>
            ipcRenderer.invoke('governance:approve-mutation', id, reason),

        /**
         * S8.3: Rejects a pending mutation by deleting it from the ledger.
         */
        rejectMutation: (id: number): Promise<void> =>
            ipcRenderer.invoke('governance:reject-mutation', id),

        /**
         * CHRON.1 (Option A): Records an orchestrator-path approval reason
         * when no mutations_ledger row exists to attach it to. Main writes a
         * governance_events row with event_type='override' and the sanitized
         * reason in metadata. Fire-and-forget from the renderer's view.
         */
        recordApprovalReason: (args: { filePath: string; toolName: string; reason: string }): Promise<void> =>
            ipcRenderer.invoke('governance:record-approval-reason', args),

        /**
         * COUNSEL.4.5: Returns the last N governance events for the Audit Log tab.
         * CHRON.1: Extended to include metadata (JSON string containing override reason)
         * and ruleId for matching override events to violation cards.
         */
        getAuditLog: (opts: { limit?: number } = {}): Promise<Array<{
            id: number | string
            timestamp: string
            action: string
            filePath: string
            description: string
            /** JSON string containing override metadata (may include a `reason` field). */
            metadata?: string | null
            /** The governance rule ID associated with this event. */
            ruleId?: string | null
        }>> =>
            ipcRenderer.invoke('governance:get-audit-log', opts),
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

    // ── Strategy 7: Deferred Violations (backward-compat shims) ───────────────
    // Canonical location: governance.deferViolation / governance.getDeferredViolations / governance.resolveDeferredViolation.
    // These top-level aliases delegate to the governance namespace and exist only
    // for backward compatibility with callers that have not migrated yet.

    /** @deprecated Use governance.deferViolation instead. */
    deferViolation: (file: string, ruleId: string, nodeId?: string, reason?: string, duration?: string): Promise<void> =>
        ipcRenderer.invoke('governance:defer-violation', file, ruleId, nodeId, reason, duration),

    /** @deprecated Use governance.getDeferredViolations instead. */
    getDeferredViolations: (): Promise<Array<{
        id: number
        file_path: string
        rule_id: string
        node_id: string | null
        reason: string | null
        duration: string | null
        expires_at: string | null
        session_id: string
        deferred_at: string
    }>> =>
        ipcRenderer.invoke('governance:get-deferred-violations'),

    /** @deprecated Use governance.resolveDeferredViolation instead. */
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
        loadDemoProject: (demoName?: string): Promise<{ projectPath: string } | { error: string }> =>
            ipcRenderer.invoke('beta:load-demo-project', { demoName }),

        /**
         * Captures a screenshot of the focused BrowserWindow via capturePage().
         * Returns a base64-encoded PNG string, or null if capture failed.
         * The screenshot is user-initiated and previewed before submission.
         */
        captureScreenshot: (): Promise<string | null> =>
            ipcRenderer.invoke('beta:capture-screenshot'),

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

    // ── BETA.3: Auto-Update IPC ───────────────────────────────────────────────
    //
    // Exposes electron-updater's update lifecycle to the renderer.
    // Push events arrive via BrowserWindow.webContents.send() from autoUpdater.ts.
    // All subscriber methods return an unsubscribe function for useEffect cleanup.

    autoUpdate: {
        /** Manually trigger an update check. Returns UpdateInfo or null if up-to-date. */
        check: (): Promise<unknown> =>
            ipcRenderer.invoke('auto-update:check'),

        /** Begin downloading the available update. Progress arrives via onDownloadProgress. */
        download: (): Promise<void> =>
            ipcRenderer.invoke('auto-update:download'),

        /** Quit the app and apply the downloaded update. Terminates the process. */
        install: (): Promise<void> =>
            ipcRenderer.invoke('auto-update:install'),

        /** Returns the current update channel ('stable' | 'beta'). */
        getChannel: (): Promise<'stable' | 'beta'> =>
            ipcRenderer.invoke('auto-update:get-channel'),

        /** Sets the update channel. Takes effect on the next check. */
        setChannel: (channel: string): Promise<void> =>
            ipcRenderer.invoke('auto-update:set-channel', { channel }),

        /** Subscribes to update-available push events. Returns unsubscribe fn. */
        onUpdateAvailable: (cb: (info: unknown) => void): (() => void) => {
            const listener = (_e: Electron.IpcRendererEvent, info: unknown) => cb(info)
            ipcRenderer.on(ipcChannel('auto-update:available'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('auto-update:available'), listener) }
        },

        /** Subscribes to download-progress push events. Returns unsubscribe fn. */
        onDownloadProgress: (cb: (progress: unknown) => void): (() => void) => {
            const listener = (_e: Electron.IpcRendererEvent, progress: unknown) => cb(progress)
            ipcRenderer.on(ipcChannel('auto-update:progress'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('auto-update:progress'), listener) }
        },

        /** Subscribes to update-downloaded (ready to install) push events. Returns unsubscribe fn. */
        onUpdateDownloaded: (cb: (info: unknown) => void): (() => void) => {
            const listener = (_e: Electron.IpcRendererEvent, info: unknown) => cb(info)
            ipcRenderer.on(ipcChannel('auto-update:downloaded'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('auto-update:downloaded'), listener) }
        },

        /** Subscribes to update error push events. Returns unsubscribe fn. */
        onError: (cb: (error: string) => void): (() => void) => {
            const listener = (_e: Electron.IpcRendererEvent, payload: { message: string }) => cb(payload.message)
            ipcRenderer.on(ipcChannel('auto-update:error'), listener)
            return () => { ipcRenderer.removeListener(ipcChannel('auto-update:error'), listener) }
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

    // ── Phase P7: Visual Regression Auditor ──────────────────────────────────
    //
    // Glass-only — the MCP-side stub delegates here via a registered bridge.
    // Spawns a hidden BrowserWindow in the main process, renders the component,
    // measures `data-flint-id` bounding boxes, and compares against Figma.
    visual: {
        audit: (payload: {
            componentCode: string
            componentName: string
            expectedBoxes: Array<{ flintId: string; width: number; height: number; x: number; y: number }>
            tolerance?: number
            viewportWidth?: number
            viewportHeight?: number
        }): Promise<{
            ok: boolean
            violations: Array<{
                flintId: string
                ruleId: 'VISUAL-REG-001'
                message: string
                expected: { width: number; height: number }
                actual: { width: number; height: number }
                deltaPx: number
                suggestion: string | null
            }>
            error: string | null
        }> => ipcRenderer.invoke('visual:audit', payload),
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

    // ── Phase 0: Coverage Honesty ────────────────────────────────────────────

    /**
     * Returns the aggregate CoverageSummary for the current project.
     *
     * The StatusBar CoverageBadge calls this on mount and on every
     * `mcp-event` push message with `eventType === "debt-scan-complete"`.
     * Until the DebtReportService integration lands, the handler returns a
     * zero-state summary (totalFiles === 0, governedSurfacePercent === 0).
     *
     * No payload required — the main process owns the current project root.
     */
    coverage: {
        getSummary: (): Promise<import('../shared/coverage-types.ts').CoverageSummary> =>
            ipcRenderer.invoke('flint:getCoverageSummary'),
    },

    // ── BETA.TEL: Telemetry Consent (BLK-3) ──────────────────────────────────
    //
    // All consent reads/writes go through this surface — the renderer never
    // touches userData/ directly (Commandment 14 / Bypass Prohibition).
    // Zod validators applied at the bridge (Commandment 16 / v2.1 hardening).

    telemetry: {
        /**
         * Returns the current consent record without mutation.
         * `state: 'unset'` means the user has never been asked.
         */
        getConsent: async (): Promise<{ state: 'unset' | 'accepted' | 'declined'; decidedAt?: string; sessionId: string }> => {
            const raw = await ipcRenderer.invoke('telemetry:get-consent')
            return telemetryGetConsentResponseSchema.parse(raw)
        },

        /**
         * Persists an accept/decline decision and returns the updated record.
         * Zod validates the payload before it crosses the process boundary.
         */
        setConsent: async (payload: { state: 'accepted' | 'declined' }): Promise<{ state: 'unset' | 'accepted' | 'declined'; decidedAt?: string; sessionId: string }> => {
            const validated = telemetrySetConsentPayloadSchema.parse(payload)
            const raw = await ipcRenderer.invoke('telemetry:set-consent', validated)
            return telemetryGetConsentResponseSchema.parse(raw)
        },
    },
})
