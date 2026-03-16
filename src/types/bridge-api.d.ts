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

/**
 * W3C DTCG $type values that Bridge supports.
 * Expanded (v2) to cover all enterprise design system dimensions so that the
 * Mithril Safety Linter can enforce every visual category, not just color.
 *
 * Mapping to Tailwind utilities:
 *   color        → bg-, text-, border-, fill-, stroke-, from-, via-, to-
 *   dimension    → p-, m-,  gap-, w-, h-, rounded-, text- (font-size)
 *   fontFamily   → font-
 *   fontWeight   → font-  (weight variant)
 *   lineHeight   → leading-
 *   letterSpacing → tracking-
 *   shadow       → shadow-
 *   opacity      → opacity-
 *   string / boolean → no direct Tailwind mapping; stored for RAG / context use
 */
export type TokenType =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'


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
 * A single design system violation produced by the Mithril Linter or A11y Linter.
 *
 * Stored in `editorStore.linterWarnings` as a `Map<string, LinterWarning>`
 * keyed by the element's `data-bridge-id`. The Map is the single source of
 * truth for every violation badge in the PropertiesPanel and the Export Gate.
 *
 * type:
 *   'color-drift'       — CIEDE2000 ΔE ≥ 2.0 (arbitrary hex vs. color token)
 *   'typography-drift'  — Arbitrary font-size/family/weight/leading/tracking vs. token
 *   'spacing-drift'     — Arbitrary p/m/gap/w/h vs. dimension token
 *   'shadow-drift'      — Arbitrary box-shadow vs. shadow token
 *   'opacity-drift'     — Arbitrary opacity vs. opacity token
 *   'a11y'              — WCAG accessibility violation (A11Y-* rules)
 *
 * severity:
 *   'amber'    — Violation present; blocks export (Mithril Commandment 6)
 *   'critical' — Color ΔE > 10.0 or mandatory a11y attr missing
 */
export interface LinterWarning {
    /** `data-bridge-id` of the violating JSX element. */
    id: string
    /** Which design system dimension was violated. */
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y'
    severity: 'amber' | 'critical'
    /**
     * For color-drift: CIEDE2000 ΔE value.
     * For all other types: 1 (presence indicator — the violation exists).
     */
    value: number
    /** Human-readable summary, e.g. "MITHRIL-TYP-001: arbitrary 'Comic Sans' not in token set". */
    message: string
    /** `token_path` of the nearest matching design token, or null if none found. */
    nearestToken: string | null
    /** Serialized value of the nearest token (hex, CSS string, etc.), or null. */
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

    /**
     * Returns all rows in `component_overrides`, ordered by `updated_at` DESC.
     * Called by `ExportModal` during the pre-flight audit to list every
     * property override that is blocking the export gate (Commandment 6).
     */
    readOverrides?: () => Promise<OverrideRow[]>
}

/**
 * A single row from the `component_overrides` SQLite table.
 * Represents one manually-overridden property on a specific element.
 */
export interface OverrideRow {
    /** The `data-bridge-id` of the element with an active override. */
    bridge_id: string
    /** The overridden property name, e.g. `"style"` or `"textContent"`. */
    property_key: string
    /** The serialised override value stored for audit / diffing. */
    property_value: string
    /** Unix timestamp (seconds) of the last write. */
    updated_at: number
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
    /**
     * Resets an existing project to the known-good 'bridge-demo' state.
     * Overwrites existing files within targetPath.
     */
    resetToDemo: (targetPath: string) => Promise<FileTreeNode>

    /**
     * Instantly scaffolds a new project at ~/Bridge Projects/Untitled-N with
     * no folder picker dialog. The first free counter slot is chosen so names
     * never collide. Returns the FileTreeNode tree rooted at the new directory.
     *
     * One click → canvas. No dialogs.
     */
    createScratchpad: () => Promise<FileTreeNode>
}

/** IPC surface for native OS menu events pushed by the main process. */
export interface MenuAPI {
    /** Registers a callback for File → New Project… (Cmd+N). */
    onNewProject: (callback: () => void) => void
    /** Registers a callback for File → Open Project… (Cmd+O). */
    onOpenProject: (callback: () => void) => void
    /** Registers a callback for File → Close Project (Cmd+Shift+W). */
    onCloseProject: (callback: () => void) => void
    /**
     * Registers a callback for File → Save Project As… (Cmd+Shift+S).
     * Fired when the user wants to relocate the current project to a new folder.
     * For scratchpad projects this is the primary "save" affordance.
     */
    onSaveProjectAs: (callback: () => void) => void
    /** Removes all listeners for all menu channels. Call in useEffect cleanup. */
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

// ── Phase N.4: Preview Engine types ────────────────────────────────────────────

/**
 * IPC surface for the programmatic Vite preview server.
 * Drives the agnostic Live Preview iframe (Phase N.4).
 */
export interface PreviewAPI {
    /**
     * Starts (or restarts) a Vite dev server at `projectRoot`.
     * The URL returned should be set as `iframe.src` in LivePreview.
     *
     * Returns `{ url }` on success or `{ error }` on failure.
     */
    start: (projectRoot: string) => Promise<{ url: string } | { error: string }>

    /** Gracefully shuts down the running preview server (idempotent). */
    stop: () => Promise<void>

    /** Returns the current preview server URL, or null if not running. */
    getUrl: () => Promise<string | null>
}

// ── Phase W.2 / W.3: Figma Connection Status ──────────────────────────────────

/**
 * Extended FigmaStatus -- adds port + secret so the renderer can render
 * copy-to-clipboard buttons without hardcoding values.
 *
 *   running       — true when the loopback ingestion server is bound and listening.
 *   lastWebhookAt — Unix timestamp (ms) of the last successful POST /ingest,
 *                   or null if no ingest has occurred in this process lifetime.
 *   tokenCount    — Current row count in the design_tokens SQLite table.
 *   port          — The port the ingestion server is actually listening on
 *                   (may differ from 4545 if port was busy).
 *   secret        — The secret value the Figma plugin must send in x-bridge-secret header.
 */
export interface FigmaStatus {
    /** True when the loopback ingestion server is bound and listening. */
    running: boolean
    /** Unix timestamp (ms) of last successful POST /ingest, or null. */
    lastWebhookAt: number | null
    /** Current row count in design_tokens table. */
    tokenCount: number
    /** The port the ingestion server is actually listening on (may differ from 4545 if port was busy). */
    port: number
    /** The secret value the Figma plugin must send in x-bridge-secret header.
     *  @deprecated Will be removed in SEC.2 — secret is now server-side only. */
    secret?: string
}

/**
 * Payload pushed from main -> renderer on first successful Figma ingest.
 */
export interface FigmaConnectedEvent {
    /** Number of tokens upserted in this ingest. */
    tokenCount: number
    /** Unix timestamp (ms) of the ingest. */
    timestamp: number
}

/**
 * Payload pushed from main -> renderer when the ingestion server rejects a request.
 */
export interface FigmaErrorEvent {
    /** HTTP status code returned to the Figma plugin. */
    statusCode: number
    /** Human-readable error reason. */
    reason: string
    /** Unix timestamp (ms) of the error. */
    timestamp: number
}

/**
 * Extended FigmaAPI -- adds lifecycle methods and push event subscriptions.
 * (Phase W.3: Figma Connect UX Overhaul)
 */
export interface FigmaAPI {
    /** Returns the current Figma ingestion server health snapshot. */
    status: () => Promise<FigmaStatus>

    /**
     * Stops the ingestion server. The server can be restarted by calling
     * disconnect then reopening the app (server starts on app launch).
     * Returns void; idempotent.
     */
    disconnect: () => Promise<void>

    /**
     * Subscribes to 'bridge:figma-connected' push events fired by the
     * ingestion server after each successful POST /ingest.
     *
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onConnected: (callback: (event: FigmaConnectedEvent) => void) => () => void

    /**
     * Subscribes to 'bridge:figma-error' push events fired by the
     * ingestion server when it rejects a request (401, 400).
     *
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onError: (callback: (event: FigmaErrorEvent) => void) => () => void

    /**
     * Removes all listeners for figma-connected and figma-error channels.
     * Call in useEffect cleanup if not using the individual unsubscribers.
     */
    removeListeners: () => void
}

// ── AI Types (Phase L) ────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'openai' | 'gemini'

export interface AIConfig {
    hasKey: boolean
    provider: AIProvider
    model: string | null
    baseURL: string | null
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool_call' | 'tool_result'
    content: string
    toolUseId?: string
    toolName?: string
    toolInput?: Record<string, unknown>
}

export interface OrchestratorChunk {
    type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'validation_error'
    text?: string
    toolName?: string
    toolInput?: Record<string, unknown>
    toolUseId?: string
    error?: string
}

export interface RAGChunk {
    id: number
    content: string
    source: string
    chunkType: string
    distance: number
}

export interface AIAPI {
    /** Start a chat turn — streams chunks back via onChunk. */
    chat: (messages: ChatMessage[], context: Record<string, unknown>) => Promise<void>
    /** Subscribe to streaming chunk events from the current ai:chat call. */
    onChunk: (callback: (chunk: OrchestratorChunk) => void) => void
    /** Remove the active chunk listener (call in useEffect cleanup). */
    removeChunkListener: () => void
    /** Returns current AI config: whether an API key is configured, the provider, and the selected model. */
    getConfig: () => Promise<AIConfig>
    /** Persist the full AI config (API key, provider, model, baseURL) to ~/.bridge/config.json. */
    saveConfig: (config: { apiKey?: string; provider: AIProvider; model?: string; baseURL?: string }) => Promise<void>

    // Phase N: Figma AST Hydrator
    hydroPaste?: (payloadStr: string) => Promise<{ ok?: boolean; imports?: string[]; elements?: Array<{ code: string; import: string | null }>; error?: string }>
    /** Listen for automatic hydro-paste events from the ingestion server. Returns unsubscribe fn. */
    onHydroPasteAuto?: (callback: (payload: string) => void) => () => void

    /** Phase M: Semantic search over the design system knowledge base. */
    queryRAG?: (query: string) => Promise<RAGChunk[]>
    /** Phase M: Ingest text chunks into the RAG vector store. */
    ingestRAG?: (chunks: Array<{ content: string; source?: string; chunkType?: string }>) => Promise<{ ingested: number }>
    /** Phase M: Clear all RAG data for re-ingestion. */
    clearRAG?: () => Promise<void>
    /** Phase M: Return the current chunk count in the RAG store. */
    ragCount?: () => Promise<number>
}

// ── Phase COLLAB.4: Annotation Types ──────────────────────────────────────────
// Renderer-side mirror of bridge-mcp/src/core/annotations/types.ts.
// Kept in sync manually — cross-boundary imports are prohibited by the
// two-tsconfig architecture.

/** The set of annotation categories supported by bridge_annotate (COLLAB.3). */
export type AnnotationType = 'note' | 'decision' | 'approval' | 'handoff'

/** Resolution status of an annotation. */
export type AnnotationStatus = 'open' | 'resolved'

/**
 * A single Bridge annotation anchoring a structured comment to a node.
 *
 * id         — Stable UUID. Never changes after creation.
 * nodeId     — The data-bridge-id of the anchored JSX element.
 * filePath   — Absolute path to the file containing the anchored element.
 * type       — Category (note | decision | approval | handoff).
 * author     — Display name of the annotation author.
 * body       — The human-readable annotation content.
 * status     — 'open' (default) or 'resolved'.
 * visibility — 'public' (default) or 'private'.
 * createdAt  — ISO 8601 timestamp of creation.
 * resolvedAt — ISO 8601 timestamp when resolved, or null.
 */
export interface BridgeAnnotation {
    id: string
    nodeId: string
    filePath: string
    type: AnnotationType
    author: string
    body: string
    status: AnnotationStatus
    visibility: 'public' | 'private'
    createdAt: string
    resolvedAt: string | null
}

/**
 * IPC surface for annotation operations (Phase COLLAB.4).
 * Exposed as `window.bridgeAPI.annotations`.
 */
export interface AnnotationsAPI {
    /**
     * Returns all annotations from .bridge/annotations.json.
     * Returns [] when the file is missing or unparseable (safe default).
     */
    readAll: () => Promise<BridgeAnnotation[]>

    /**
     * Marks the annotation with `id` as resolved. Writes the updated list
     * back to .bridge/annotations.json atomically via tmp→rename.
     * No-ops silently if the id does not exist.
     */
    resolve: (id: string) => Promise<void>

    /**
     * Registers `cb` to be called whenever .bridge/annotations.json changes
     * on disk (via main-process fs.watch). The callback receives no arguments —
     * callers should invoke fetchAnnotations() in response.
     *
     * Call `removeChangedListener()` in a useEffect cleanup to prevent leaks.
     */
    onChanged: (cb: () => void) => void

    /** Removes all 'bridge:annotations-changed' listeners. */
    removeChangedListener: () => void
}

// ── Phase W: MCP Push Channel + Bidirectional Action Bridge ──────────────────

/**
 * Event types that the MCP server appends to `.bridge/mcp-events.jsonl`
 * after each tool completion.
 */
export type MCPEventType = 'violation' | 'annotation' | 'mutation' | 'audit' | 'fix' | 'debt'

/** Severity levels for MCPEvent — drives notification styling in Glass. */
export type MCPEventSeverity = 'critical' | 'warning' | 'info'

/**
 * A single event record appended to `.bridge/mcp-events.jsonl` by the MCP
 * server and tail-followed by the Electron main process.
 *
 * timestamp — Unix timestamp in milliseconds.
 * type      — Category of event (violation, annotation, mutation, etc.).
 * severity  — Drives toast colour and notification priority.
 * summary   — Human-readable one-line description for the Glass toast.
 * nodeId    — Optional `data-bridge-id` of the affected JSX element.
 * filePath  — Optional absolute path to the affected source file.
 */
export interface MCPEvent {
    timestamp: number
    type: MCPEventType
    severity: MCPEventSeverity
    summary: string
    nodeId?: string
    filePath?: string
}

/** Result of an MCP tool call — mirrors MCP CallToolResult schema. */
export interface MCPCallResult {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
}

/** Result of reading an MCP resource — mirrors MCP ReadResourceResult schema. */
export interface MCPResourceResult {
    contents: Array<{ uri: string; mimeType?: string; text?: string }>
}

/** Connection status of the MCP server child process. */
export interface MCPClientStatus {
    /** True when the server process is running and has completed the initialize handshake. */
    connected: boolean
    /** PID of the server child process, or null if not running. */
    serverPid: number | null
}

/**
 * IPC surface for the MCP integration (Phase W).
 * Exposed as `window.bridgeAPI.mcp`.
 *
 * All operations execute in the main process via stdio to the MCP server.
 * The renderer never touches the child process directly.
 */
export interface MCPAPI {
    /**
     * Invokes an MCP tool by `name` with `args`.
     * Rejects if the server is not connected or the call times out (30 s).
     */
    callTool: (name: string, args: Record<string, unknown>) => Promise<MCPCallResult>

    /**
     * Reads an MCP resource by URI.
     * Rejects if the server is not connected or the call times out (30 s).
     */
    readResource: (uri: string) => Promise<MCPResourceResult>

    /**
     * Returns the current MCP server connection status.
     * Safe to call at any time — does not block.
     */
    status: () => Promise<MCPClientStatus>

    /**
     * Subscribes `callback` to `bridge:mcp-event` push events.
     * Events are batched within a 500ms window before dispatch.
     * Call `removeEventListener()` in useEffect cleanup to prevent leaks.
     */
    onEvent: (callback: (events: MCPEvent[]) => void) => void

    /** Removes all `bridge:mcp-event` listeners. Call in useEffect cleanup. */
    removeEventListener: () => void
}

// ── Phase ING: Ingestion-Time Audit & Auto-Heal ───────────────────────────────

/**
 * Tier classification for a single ingestion violation.
 *   tier1 — Exact match: auto-fix applied silently.
 *   tier2 — Near-match: flagged for one-click review.
 *   tier3 — Unknown: no close token; standard governance handles it.
 */
export type IngestionTier = 'tier1' | 'tier2' | 'tier3'

/** Result of the ingestion heal pass (from IngestionAuditor.heal()). */
export interface IngestionHealResult {
    healedCode: string
    summary: IngestionSummary
}

/**
 * Summary pushed from main → renderer via 'bridge:import-summary' IPC.
 * Stored in importSummaryStore. Rendered by ImportSummary component.
 */
export interface IngestionSummary {
    totalValues: number
    tier1Fixed: IngestionFix[]
    tier2Flagged: IngestionFlag[]
    tier3Unknown: number
    healTimeMs: number
    preHealCode: string
}

/** A single tier-1 auto-fix applied during ingestion. */
export interface IngestionFix {
    nodeId: string
    ruleId: string
    originalValue: string
    fixedToToken: string
    fixedToClass: string
}

/** A single tier-2 near-match flagged during ingestion. */
export interface IngestionFlag {
    nodeId: string
    ruleId: string
    originalValue: string
    suggestedToken: string
    suggestedClass: string
    distance: number
    distanceUnit: 'deltaE' | 'px'
}

/** Payload for 'import:snap-to-token' IPC (renderer → main). */
export interface SnapToTokenPayload {
    nodeId: string
    tokenPath: string
    className: string
    originalClass: string
}

/** IPC surface for the ingestion heal pass (window.bridgeAPI.importSummary). */
export interface ImportSummaryAPI {
    onSummary: (callback: (summary: IngestionSummary) => void) => () => void
    snapToToken: (payload: SnapToTokenPayload) => Promise<{ ok: boolean; updatedSummary?: IngestionSummary }>
    undoAllHeals: (preHealCode: string) => Promise<{ ok: boolean }>
    removeListeners: () => void
}

// ── Phase ACX.5: Context Sync Types ──────────────────────────────────────────

/**
 * Live state snapshot written to `.bridge/context.json` by `useContextSync`
 * every 200 ms (debounced). The MCP server reads this file via
 * `bridge_get_context` / `bridge://context` to stay synchronized with the
 * visual Glass layer without requiring direct IPC coupling.
 *
 * All new fields are optional for backward compatibility — older context.json
 * files written before ACX.5 will still parse correctly.
 *
 * Context Bridge Awareness (CLAUDE.md §8): any new Glass state that should
 * be visible to the MCP server must be added to this type AND populated in
 * `useContextSync`.
 */
export interface BridgeContext {
    /** Unix timestamp (ms) of when this snapshot was assembled. */
    timestamp: number

    /** Absolute path of the currently open file, or null. */
    activeFile: string | null

    /** data-bridge-id of the selected node, or null. */
    selectedNodeId: string | null

    /** Cursor position in the source editor, or null. */
    cursorPosition: { line: number; column: number } | null

    /** Aggregated violation counts for the current file. */
    violations: {
        mithrilCount: number
        a11yCount: number
        criticalCount: number
        /** All data-bridge-ids that have at least one violation. */
        nodeIds: string[]
    }

    /** Current phase of the auto-save pipeline. */
    saveState: string

    /** Current interaction mode: 'design' or 'interact'. */
    canvasMode: string

    /** Absolute paths of all currently open files. */
    openFiles: string[]

    // ── ACX.5 extension fields (all optional — backward compatible) ──────────

    /**
     * Design debt health score (0–100) for the active project.
     * Sourced from the debt report, or null when unavailable.
     */
    healthScore?: number | null

    /**
     * Letter grade corresponding to the health score (A/B/C/D/F).
     * Null when no score is available.
     */
    healthGrade?: string | null

    /**
     * Number of active governance rule overrides in the current session.
     * Used by the MCP server to assess compliance posture.
     */
    overrideCount?: number | null

    /**
     * Summary of the most recent Figma ingestion heal pass.
     * Null when no import has occurred in this session.
     */
    importSummary?: {
        tier1Fixed: number
        tier2Flagged: number
        tier3Unknown: number
    } | null

    // ── Phase ACX.5: enriched context fields for agent awareness ─────────────

    /**
     * First 200 lines of the active file's source code.
     * Allows MCP agents to read the current component without a separate
     * `bridge_read_code` call. Null when no file is open.
     */
    sourceExcerpt?: string | null

    /**
     * Descriptor of the currently selected node.
     * Null when no node is selected.
     */
    selectedNodeSummary?: {
        tagName: string
        bridgeId: string
        className: string | null
        props: Record<string, string>
        childCount: number
        parentId: string | null
    } | null

    /**
     * Structured violation snapshot for agent awareness.
     * Derived from linterWarnings — gives agents a quick picture of
     * current governance health without a separate audit call.
     */
    violationSnapshot?: {
        total: number
        criticalCount: number
        exportBlocked: boolean
        exportBlockReason: string | null
    } | null
}

/**
 * Enriched context returned by `context:get-enriched` IPC.
 * Extends the raw BridgeContext snapshot with live SQLite metrics
 * assembled in the main process: token count, override count, health score.
 *
 * Used by ACX.1 `sessionContext.ts` to assemble `bridge://session-context`.
 */
export interface EnrichedContext extends BridgeContext {
    /** Total design token count from the design_tokens table. */
    tokenCount: number
    /** Number of active export-blocking overrides in component_overrides. */
    activeOverrideCount: number
    /** ISO 8601 UTC timestamp of when this enriched snapshot was assembled. */
    enrichedAt: string
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

    /** Figma connection health — ingestion server status, last sync, token count. */
    figma: FigmaAPI

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

    // ── Phase L: AI Orchestration Engine ──────────────────────────────────────

    /**
     * Applies an array of AST mutations to the active file via the main process.
     * Thin IPC wrapper — the full safety pipeline (Mithril, a11y, FileTransactionManager)
     * runs identically to a UI-initiated applyBatch call.
     */
    applyBatch: (mutations: unknown[]) => Promise<{ ok: boolean; error?: string }>

    /** AI Orchestration API — Anthropic Claude backend, runs in main process. */
    ai: AIAPI

    // ── Phase COLLAB.4: Annotation IPC surface ────────────────────────────────

    /**
     * Annotation read + resolve API — backed by .bridge/annotations.json.
     * Written by MCP tools; read and resolved by Glass (COLLAB.4).
     *
     * Optional-chained by callers (`window.bridgeAPI.annotations?.readAll()`)
     * so Vitest / headless environments degrade gracefully.
     */
    annotations?: AnnotationsAPI

    // ── Phase N.4: Preview Engine ──────────────────────────────────────────────

    /** Programmatic Vite dev server API — agnostic preview engine. */
    preview: PreviewAPI
    // ── Phase P: Integrated Terminal ──────────────────────────────────────────
    terminal: {
        spawn: (cwd: string) => Promise<void>
        write: (data: string) => Promise<void>
        resize: (cols: number, rows: number) => Promise<void>
        onOutput: (callback: (data: string) => void) => () => void
    }

    // ── Phase W: MCP Push Channel + Bidirectional Action Bridge ───────────────

    /**
     * MCP integration — push events from the MCP server + bidirectional tool invocation.
     *
     * Optional-chained by callers (`window.bridgeAPI.mcp?.callTool(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    mcp?: MCPAPI

    // ── GOV.1 + GOV.2: Governance Provenance + Override Telemetry ─────────────

    /**
     * Governance telemetry API — rule provenance lookup and override event recording.
     * Exposed as window.bridgeAPI.governance.
     */
    governance: GovernanceAPI

    /**
     * Delta Mode baseline API — snapshot current violations so Bridge only
     * reports NEW issues going forward (Gap 6).
     *
     * Optional-chained by callers (`window.bridgeAPI.baseline?.set(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    baseline?: BaselineAPI

    /**
     * Governance Policy API — reads the configurable policy engine settings
     * from `.bridge/policy.json` (Gap 3).
     *
     * Optional-chained by callers (`window.bridgeAPI.policy?.get()`)
     * so Vitest / headless environments degrade gracefully.
     */
    policy?: PolicyAPI

    // ── Phase ING: Ingestion-Time Audit & Auto-Heal ───────────────────────────

    /**
     * Import summary push channel — receives heal results after each /ingest-ast pass.
     * Exposes snap-to-token and undo-all-heals actions for tier-2 review UI.
     *
     * Optional-chained so Vitest/headless environments degrade gracefully.
     */
    importSummary?: ImportSummaryAPI

    // ── Phase ACX.5: Context Sync Pipeline ────────────────────────────────────

    /**
     * Writes a BridgeContext snapshot to `.bridge/context.json` in the main
     * process. Called by `useContextSync` on every meaningful state change
     * (debounced at 200 ms). Fire-and-forget — the promise resolves when the
     * file write completes but the renderer does not need the result.
     *
     * This is the sole mechanism by which the MCP server learns about live
     * Glass state. Do not call `fs.writeFile` directly — route through this
     * IPC channel so the write goes through the main process.
     */
    syncContext: (context: BridgeContext) => Promise<void>

    /**
     * Returns an enriched context snapshot assembled from `.bridge/context.json`
     * plus live SQLite metrics (token count, override count, health score).
     * Intended for use by ACX session-context assembly — not needed for everyday
     * Glass rendering, but exposed so the renderer can trigger a one-shot
     * snapshot when needed (e.g. before handing off to an MCP agent).
     *
     * Optional-chained by callers so headless / test environments degrade
     * gracefully.
     */
    context?: {
        getEnriched: () => Promise<EnrichedContext>
    }
}

// ── GOV.1 + GOV.2: Governance Provenance + Override Telemetry ────────────────

/**
 * Regulatory source authority that a governance rule traces back to.
 * Renderer-side mirror of the bridge-mcp SourceAuthority type.
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Bridge Design System'
    | 'Custom'

/**
 * Provenance metadata for a single governance rule.
 * Resolved from the static ruleProvenanceRegistry keyed by ruleId.
 * Renderer-side mirror of the bridge-mcp RuleProvenance type.
 */
export interface RuleProvenance {
    /** The rule identifier, e.g. 'A11Y-001', 'MITHRIL-TYP-002'. */
    ruleId: string
    /** Human-readable rule name. */
    ruleName: string
    /** Which regulatory body or standard this rule satisfies. */
    sourceAuthority: SourceAuthority
    /** Specific clause or section reference, e.g. 'WCAG 2.1 SC 1.1.1'. */
    regulatoryReference: string
    /** ISO 8601 date when the rule definition was last reviewed. */
    lastUpdated: string
    /** Brief rationale for why this rule exists. */
    rationale: string
}

/**
 * Compliance summary returned by the governance IPC.
 * Used by ExportModal to render the "Compliance Summary" section (GOV.1).
 */
export interface ComplianceSummary {
    /** Total violation count. */
    totalViolations: number
    /** Breakdown by source authority. */
    byAuthority: Record<string, number>
    /** Breakdown by severity. */
    bySeverity: Record<string, number>
    /** Full provenance records for each unique violated rule. */
    violatedRules: RuleProvenance[]
    /** ISO 8601 timestamp when this summary was generated. */
    generatedAt: string
}

/**
 * IPC surface for governance telemetry operations (GOV.1 + GOV.2).
 * Exposed as window.bridgeAPI.governance.
 */
export interface GovernanceAPI {
    /**
     * Records a rule override event to the governance_events table.
     * Fire-and-forget — the renderer does not need the result.
     *
     * @param payload.ruleId    — The rule being overridden (e.g. 'A11Y-001').
     * @param payload.action    — 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'.
     * @param payload.newValue  — The new state: { enabled?: boolean; severity?: string } or null for reset_all.
     * @param payload.filePath  — Active file path when the override was made.
     */
    recordOverride: (payload: {
        ruleId: string
        action: 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'
        newValue: { enabled?: boolean; severity?: string } | null
        filePath: string
    }) => Promise<void>

    /**
     * Returns the count of 'override' events in the current session.
     * Used by StatusBar to show "Overrides (N)" badge.
     */
    getOverrideCount: () => Promise<number>

    /**
     * Returns a ComplianceSummary for the given violation ruleIds.
     * Used by ExportModal to render the "Compliance Summary" section.
     *
     * @param ruleIds — Deduplicated list of violated ruleIds from the current audit.
     */
    getComplianceSummary: (ruleIds: string[]) => Promise<ComplianceSummary>

    /**
     * Subscribe to override recording events pushed by the main process.
     * The main process pushes 'bridge:governance-override-recorded' after
     * each successful recordEvent call so StatusBar can re-fetch the count
     * without polling.
     *
     * Returns an unsubscribe function — pass it to useEffect cleanup.
     */
    onOverrideRecorded: (cb: () => void) => () => void
}

// ── Delta Mode: Baseline Types (Gap 6) ───────────────────────────────────────

/**
 * A single row from the `violation_baselines` SQLite table.
 * Returned by `window.bridgeAPI.baseline.get(filePath)`.
 *
 * file_path      — Absolute path of the file the violation was found in.
 * node_id        — The data-bridge-id of the violating JSX element.
 * rule_id        — The violation type, e.g. 'color-drift', 'a11y'.
 * severity       — Severity at snapshot time ('amber' | 'critical').
 * snapshot_value — Serialised violation value at snapshot time, or null.
 */
export interface BaselineEntry {
    file_path: string
    node_id: string
    rule_id: string
    severity: string
    snapshot_value: string | null
}

/**
 * IPC surface for the violation baseline feature (Delta Mode).
 * Exposed as `window.bridgeAPI.baseline`.
 *
 * set(violations)  — Bulk-upserts the provided violations as the new baseline.
 *                    Idempotent: re-running on the same (node_id, rule_id) just
 *                    refreshes snapshot_value. fire-and-forget from the UI.
 * get(filePath)    — Returns all baseline entries for the given file.
 *                    Used by the renderer to compute delta = current − baseline.
 * clear()          — Deletes all baseline rows (resets delta mode globally).
 * isSet()          — Returns true when any baseline rows exist, so the UI can
 *                    show a "Delta Mode" badge without fetching the full list.
 */
export interface BaselineAPI {
    set: (violations: Array<{
        nodeId: string
        ruleId: string
        severity: string
        filePath: string
        value?: string
    }>) => Promise<void>

    get: (filePath: string) => Promise<BaselineEntry[]>

    clear: () => Promise<void>

    isSet: () => Promise<boolean>
}

// ── Policy Engine Types (Gap 3) ─────────────────────────────────────────────

/**
 * Governance enforcement mode for a rule category.
 *   blocking  — violations block export (current default)
 *   advisory  — violations warn but do not block export
 *   off       — rule category disabled entirely
 */
export type PolicyMode = 'blocking' | 'advisory' | 'off'

/**
 * The `.bridge/policy.json` schema — renderer-side mirror.
 */
export interface BridgePolicy {
    version: number
    mithril: {
        deltaE_threshold: number
        deltaE_critical_threshold: number
        mode: PolicyMode
        ignore_patterns: string[]
    }
    a11y: {
        level: 'A' | 'AA' | 'AAA'
        mode: PolicyMode
        disabled_rules: string[]
    }
    export_gate: {
        block_on_mithril: boolean
        block_on_a11y: boolean
        block_on_overrides: boolean
    }
    baseline: {
        enabled: boolean
    }
}

/**
 * IPC surface for reading the governance policy (Gap 3).
 * Exposed as `window.bridgeAPI.policy`.
 */
export interface PolicyAPI {
    /**
     * Returns the active governance policy from the main process.
     * Reads `.bridge/policy.json` from the project root; returns
     * DEFAULT_POLICY if missing or malformed.
     */
    get: () => Promise<BridgePolicy>
}

declare global {
    interface Window {
        bridgeAPI: BridgeAPI
    }
}

