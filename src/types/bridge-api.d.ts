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

export interface BridgeAPI {
    /** Health-check: verifies the IPC bridge is functional. */
    ping: () => Promise<string>

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
}

declare global {
    interface Window {
        bridgeAPI: BridgeAPI
    }
}
