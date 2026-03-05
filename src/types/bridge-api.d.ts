/**
 * Type declarations for the window.bridgeAPI exposed
 * by the Electron preload script via contextBridge.
 *
 * This gives the React Renderer full autocomplete and type safety
 * without ever importing Node.js modules.
 *
 * IMPORTANT: The token types below are the renderer-side mirror of
 * electron/token-types.ts. They must be kept in sync manually —
 * imports across the electron/src boundary are prohibited by the
 * two-tsconfig architecture.
 */

export interface ServerStatus {
    /** True when the ingestion HTTP server is bound and listening. */
    running: boolean
    /** The port the server is listening on (4545 in all environments). */
    port: number
}

// ── Token Types (renderer-side mirror of electron/token-types.ts) ─────────────

/** The four W3C DTCG $type values that Bridge supports. */
export type TokenType = 'color' | 'dimension' | 'string' | 'boolean'

/**
 * A fully-persisted design token as returned from the database via IPC.
 * `id` is the SQLite INTEGER PRIMARY KEY (auto-incremented).
 *
 * v2: Uniqueness is defined by the composite key (token_path, mode, collection_name),
 * enabling the same semantic path to hold distinct values per theme mode.
 */
export interface DesignToken {
    id: number
    /** Dot-and-hyphen path, e.g. "color-brand.primary", "spacing.medium" */
    token_path: string
    /** W3C DTCG $type */
    token_type: TokenType
    /** Serialized value: hex for color, CSS string for dimension, etc. */
    token_value: string
    description: string | null
    /** Theme mode, e.g. "Light", "Dark", or "default" for single-mode collections. */
    mode: string
    /** Figma collection name stored verbatim, e.g. "Color Tokens". */
    collection_name: string
}

/**
 * Input shape for creating a new token.
 * `id` is omitted — SQLite generates it automatically via AUTOINCREMENT.
 * `mode` and `collection_name` fall back to 'default' at the DB level when omitted.
 */
export interface NewDesignToken {
    token_path: string
    token_type: TokenType
    token_value: string
    description?: string
    /** Defaults to 'default' if omitted. */
    mode?: string
    /** Defaults to 'default' if omitted. */
    collection_name?: string
}

/**
 * A single perceptual-drift warning produced by the Mithril Linter.
 *
 * Stored in `editorStore.linterWarnings` as a `Map<string, LinterWarning>`
 * keyed by the element's `data-bridge-id`. The Map is the single source of
 * truth for every violation badge in the PropertiesPanel and the Export Gate.
 *
 * severity:
 *   'amber'    — ΔE 2.0 – 10.0  (perceptible drift; Mithril Violation)
 *   'critical' — ΔE > 10.0      (severe drift; hard export block)
 */
export interface LinterWarning {
    /** `data-bridge-id` of the violating JSX element. */
    id: string
    type: 'drift'
    severity: 'amber' | 'critical'
    /** CIEDE2000 ΔE value (worst offender across all className hex tokens). */
    value: number
    /** Human-readable summary, e.g. "ΔE 3.4 – use color.brand.primary". */
    message: string
    /** `token_path` of the nearest matching design token, or null if none found. */
    nearestToken: string | null
    /** Hex value of the nearest token, e.g. "#6366f1", or null if none found. */
    nearestTokenValue: string | null
}

/**
 * The mutable fields accepted by `window.bridgeAPI.tokens.update()`.
 * `id`, `token_path`, `mode`, and `collection_name` are intentionally excluded —
 * they form the composite identity key.
 * At least one field must be present per call.
 */
export interface DesignTokenUpdate {
    token_type?: TokenType
    token_value?: string
    description?: string | null
}

/** The IPC surface for design token CRUD operations (Module F). */
export interface TokensAPI {
    /**
     * Persists a new token using an UPSERT. If (token_path, mode, collection_name)
     * already exists, updates token_value and description in place.
     * Returns the row's integer id.
     */
    create: (token: NewDesignToken) => Promise<{ id: number }>

    /** Returns all tokens ordered by collection_name, mode, then token_path. */
    readAll: () => Promise<DesignToken[]>

    /**
     * Updates mutable fields on all tokens matching `tokenPath`.
     * Returns `{ changes: 0 }` if the path is not found.
     */
    update: (tokenPath: string, updates: DesignTokenUpdate) => Promise<{ changes: number }>

    /**
     * Deletes the token with the given integer `id`.
     * Returns `{ changes: 0 }` if the id is not found.
     */
    delete: (id: number) => Promise<{ changes: number }>

    /** Deletes ALL tokens from the database. Returns the number of removed rows. */
    clearAll: () => Promise<{ changes: number }>

    /**
     * Removes the `component_overrides` row associated with `bridgeId`.
     * Called by the AST deleteNode garbage collector (Phase E) to prevent
     * "Zombie" export locks after a node is deleted from the source file.
     *
     * Optional-chained by callers (`window.bridgeAPI.tokens.clearOverride?.(...)`).
     */
    clearOverride?: (bridgeId: string) => Promise<void>

    /**
     * Inserts or replaces a single property row in `component_overrides`.
     * Called by PropertiesPanel after every style / textContent commit to
     * set an export lock on the specific overridden property.
     *
     * @param bridgeId      — `data-bridge-id` of the mutated element.
     * @param propertyKey   — Name of the overridden prop (e.g. `"style"`, `"textContent"`).
     * @param propertyValue — Serialised new value stored for audit / diffing.
     *
     * Optional-chained by callers (`window.bridgeAPI.tokens.upsertOverride?.(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    upsertOverride?: (bridgeId: string, propertyKey: string, propertyValue: string) => Promise<void>
}

// ── Sync / Presence types (Module G) ─────────────────────────────────────────

/**
 * The four states the PowerSync real-time layer can occupy.
 *   CONNECTING   — initial handshake with the PowerSync backend in progress
 *   CONNECTED    — live sync active; changes propagate to all collaborators
 *   OFFLINE_MODE — no backend configured; operating on local SQLite only
 *   SYNC_ERROR   — backend was reachable but a protocol or auth error occurred
 */
export type SyncState = 'CONNECTING' | 'CONNECTED' | 'OFFLINE_MODE' | 'SYNC_ERROR'

/**
 * A single row returned by `window.bridgeAPI.readPresence()`.
 * Matches the SQLite `presence` table schema exactly (snake_case columns).
 * `updated_at` is a Unix timestamp (seconds since epoch).
 */
export interface PresenceRow {
    /** Session UUID — matches the sender's presenceSessionId. */
    id: string
    /** Display handle, e.g. "User-A3F2". */
    user_id: string
    /** Bridge ID of the element being dragged / selected, or '' when idle. */
    node_id: string
    /** Cursor X coordinate in Shield/iframe space. */
    x: number
    /** Cursor Y coordinate in Shield/iframe space. */
    y: number
    /** Unix timestamp of the last write (seconds). */
    updated_at: number
}

/** Payload sent to the `sync:update-presence` IPC handler. */
export interface PresencePayload {
    /** Session UUID — identifies this user's row in the presence table. */
    id: string
    /** Human-readable display name or generated handle. */
    userId: string
    /** Bridge ID of the currently selected layer, or '' if nothing is selected. */
    nodeId?: string
    /** Cursor X coordinate in canvas space. */
    x: number
    /** Cursor Y coordinate in canvas space. */
    y: number
}

/**
 * A node in the recursive file tree returned by `window.bridgeAPI.openFolder()`.
 * Directories carry a `children` array; files do not.
 */
export interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    children?: FileTreeNode[]
}

// ── Project Registry types (Phase G) ─────────────────────────────────────────

/**
 * A row from the `recent_projects` table in `bridge-registry.db`.
 * `last_opened` is a Unix timestamp (seconds since epoch).
 */
export interface RecentProject {
    /** Stable UUID assigned on first project insertion. */
    id: string
    /** Human-readable project name (typically the root directory basename). */
    name: string
    /** Absolute path to the project root directory. */
    path: string
    /** Unix timestamp (seconds) of the most recent open. */
    last_opened: number
}

/** IPC surface for the global bridge-registry.db (Launch Screen). */
export interface RegistryAPI {
    /** Returns up to 10 recently opened projects, newest first. */
    getRecent: () => Promise<RecentProject[]>
    /**
     * Records or refreshes a project entry in the registry.
     * Called after `openFolder` so manually opened folders appear in the list.
     */
    upsertProject: (payload: { name: string; path: string }) => Promise<void>
    /**
     * Removes the project with the given UUID from the registry.
     * Called when the user dismisses a project from the Recent Projects list.
     */
    removeProject: (id: string) => Promise<void>
}

/** IPC surface for project lifecycle operations (Phase G). */
export interface ProjectAPI {
    /**
     * Scaffolds a new Bridge workspace by copying a bundled template into an
     * empty user-selected directory, then writes to the registry and scans.
     *
     * @param payload.targetPath — Absolute path to an **empty** directory.
     * @param payload.templateId — Template name (e.g. `'base-vite-tailwind'`).
     * @returns The FileTreeNode tree rooted at `targetPath`.
     *
     * Throws if the directory is non-empty, the path is outside the home dir,
     * or the templateId is unknown.
     */
    initialize: (payload: { targetPath: string; templateId: string }) => Promise<FileTreeNode>
    /**
     * Opens an existing project by its absolute path: scans for source files,
     * writes to the registry, and returns the FileTreeNode tree.
     *
     * Returns `null` when the path is outside the home directory or the scan
     * fails (e.g. the directory was deleted).
     */
    openPath: (folderPath: string) => Promise<FileTreeNode | null>
}

/** IPC surface for native OS menu events pushed by the main process. */
export interface MenuAPI {
    /** Registers a callback for File → New Project… (Cmd+N). */
    onNewProject: (callback: () => void) => void
    /** Registers a callback for File → Open Project… (Cmd+O). */
    onOpenProject: (callback: () => void) => void
    /** Registers a callback for File → Close Project (Cmd+Shift+W). */
    onCloseProject: (callback: () => void) => void
    /** Removes all listeners for the three menu channels. Call in useEffect cleanup. */
    removeMenuListeners: () => void
}

/**
 * A single entry in the git shadow commit log for a file.
 * Returned by `window.bridgeAPI.gitLog(filePath)`.
 */
export interface GitLogEntry {
    /** Abbreviated git commit hash (7 chars). */
    hash: string
    /** Commit message, e.g. "bridge:sync:uuid". */
    message: string
    /** Unix timestamp in seconds (author timestamp from `--pretty=format:%at`). */
    timestamp: number
}

export interface BridgeAPI {
    /** Health-check: verifies the IPC bridge is functional. */
    ping: () => Promise<string>

    /**
     * Shows the native OS directory picker and returns only the selected path
     * string (no scan). Used by the "New Project" flow to pick an empty target
     * directory before calling `project.initialize`.
     *
     * Returns `null` if the user cancels or selects outside their home dir.
     */
    selectFolder: () => Promise<string | null>

    /** Project Registry CRUD — backed by the global bridge-registry.db. */
    registry: RegistryAPI

    /** Project lifecycle operations — scaffolding and path-based open. */
    project: ProjectAPI

    /**
     * Transforms TSX source into preview-ready JS using Babel in the main process.
     * Import statements are stripped and `export default` is rewritten so the JS
     * can run inside a srcdoc iframe where React/ReactDOM are UMD globals.
     *
     * @returns `{ js, error: null }` on success, `{ js: null, error }` on failure.
     */
    transformCode: (code: string) => Promise<{ js: string | null; error: string | null }>

    /**
     * Queries the Main Process for the current ingestion server state.
     * Call this before instructing the Figma plugin to begin sending assets.
     *
     * @example
     * const status = await window.bridgeAPI.getServerStatus()
     * if (status.running) {
     *   console.log(`Server is live on port ${status.port}`)
     * }
     */
    getServerStatus: () => Promise<ServerStatus>

    /** Design token CRUD — backed by the design_tokens SQLite table. */
    tokens: TokensAPI

    /**
     * Subscribes `callback` to the `tokens-updated` IPC event, which the
     * ingestion server broadcasts after every successful Figma sync.
     * Call `removeTokensUpdatedListener()` in the effect cleanup to prevent
     * duplicate subscriptions.
     */
    onTokensUpdated: (callback: () => void) => void

    /** Removes all listeners registered for the `tokens-updated` channel. */
    removeTokensUpdatedListener: () => void

    /**
     * Subscribes to live design token updates from the SQLite database.
     *
     * Calls `callback` immediately with the current token list, then again
     * on every subsequent write to the design_tokens table — whether from a
     * local CRUD operation (create / update / delete / clearAll) or a Figma
     * ingestion sync.
     *
     * Returns an unsubscribe function — pass it to a `useEffect` cleanup to
     * prevent memory leaks on component unmount.
     *
     * Replaces the manual `fetchTokens()` + `onTokensUpdated()` re-fetch cycle
     * with a reactive, push-based model (Commandment 4 — Local-First: works
     * fully offline with no backend required).
     */
    watchTokens: (callback: (tokens: DesignToken[]) => void) => () => void

    /**
     * UPSERTs the local user's presence record in the main-process SQLite DB.
     *
     * The renderer throttles calls to ≤ 1 per 50–100 ms using the
     * `useSyncPresence` hook. The main process performs a single UPSERT per
     * invocation with no additional batching.
     */
    syncPresence: (payload: PresencePayload) => Promise<void>

    /**
     * Returns all presence rows whose `updated_at` is within the last 30 s.
     * The renderer polls this at ~5 Hz via `useRemotePresence()` to drive the
     * remote-cursor overlay on the Shield. The local session row should be
     * filtered out client-side using `presenceSessionId` from PresenceService.
     */
    readPresence: () => Promise<PresenceRow[]>

    /**
     * Atomically writes `content` to the file at `filePath` via the
     * main-process `FileTransactionManager`.
     *
     * The write is two-phase: content is staged to `<filePath>.tmp` first,
     * then `fs.rename()` overwrites the target in a single kernel operation.
     * Rapid-fire writes to the same path are serialised without race conditions;
     * writes to different paths proceed concurrently.
     *
     * Constraints enforced by the main process:
     *   • `filePath` must be absolute.
     *   • `filePath` must end with `.tsx`, `.ts`, `.jsx`, or `.js`.
     *   • `filePath` must reside within the user's home directory.
     */
    saveFile: (filePath: string, content: string) => Promise<void>

    /**
     * Atomically writes every `(filePath, content)` pair in `batch` via the
     * main-process `FileTransactionManager`.
     *
     * Each path is validated by the main process (absolute, correct extension,
     * inside the user's home directory). Writes to different paths run
     * concurrently; writes to the same path are serialised in FIFO order.
     *
     * Rejects if any path fails validation or if any atomic rename fails.
     *
     * Use this for multi-file cross-component moves (Phase F.2) so a single
     * IPC round-trip commits all dirty buffers at once.
     */
    saveFileBatch: (batch: Record<string, string>) => Promise<void>

    /**
     * Shows the native OS directory picker. On success, recursively scans the
     * selected directory for `.tsx`, `.ts`, `.jsx`, and `.js` files and returns
     * a nested `FileTreeNode` tree rooted at the chosen folder.
     *
     * Excluded automatically: `node_modules`, `dist`, `dist-electron`, `.git`,
     * hidden directories, and directories that contain no source files.
     *
     * Returns `null` if the user cancels the picker.
     */
    openFolder: () => Promise<FileTreeNode | null>

    /**
     * Reads the raw UTF-8 content of a source file in the user's home directory.
     *
     * Security constraints (enforced by the main process):
     *   • `filePath` must be absolute.
     *   • `filePath` must end with `.tsx`, `.ts`, `.jsx`, or `.js`.
     *   • `filePath` must reside within the user's home directory.
     */
    readFile: (filePath: string) => Promise<string>

    /**
     * Returns the raw source content of `filePath` at `commitHash` by running
     * `git show <commitHash>:<relPath>` in the main process.
     *
     * Returns `null` when the commit or file does not exist in git history,
     * when `filePath` is outside the user's home directory, or when
     * `commitHash` is not a valid hex SHA (4–64 chars).
     *
     * Does NOT modify the working tree. Does NOT call `git checkout`.
     */
    gitShow: (filePath: string, commitHash: string) => Promise<string | null>

    /**
     * Returns a chronological list of up to 50 shadow commits that have touched
     * `filePath` in the local git repository.
     *
     * Used by `RecoveryPanel` to populate the file's Time Machine timeline.
     * Returns an empty array when the file is not tracked by git.
     */
    gitLog: (filePath: string) => Promise<GitLogEntry[]>

    /** Native OS menu event subscriptions (File → New / Open / Close Project). */
    menu: MenuAPI
}

declare global {
    interface Window {
        bridgeAPI: BridgeAPI
    }
}
