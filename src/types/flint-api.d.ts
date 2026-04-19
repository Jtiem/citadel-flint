/**
 * Type declarations for the window.flintAPI exposed
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
 * W3C DTCG $type values that Flint supports.
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
 * keyed by the element's `data-flint-id`. The Map is the single source of
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
    /** `data-flint-id` of the violating JSX element. */
    id: string
    /** Which design system dimension was violated. */
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y' | 'semantic-drift' | 'sync' | 'inline-style-drift' | 'registry'
    severity: 'amber' | 'critical' | 'advisory'
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
    /** COUNSEL.3.4: Sentry risk trend for the file containing this violation. */
    riskTrend?: 'rising' | 'falling' | 'stable'
    /** COUNSEL.3.4: Sentry MRS score (0-100) when the violation has been risk-scored. */
    mrsScore?: number | null
}


/**
 * The mutable fields accepted by `window.flintAPI.tokens.update()`.
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
     * Removes the `component_overrides` row associated with `flintId`.
     * Called by the AST deleteNode garbage collector (Phase E) to prevent
     * "Zombie" export locks after a node is deleted from the source file.
     *
     * Optional-chained by callers (`window.flintAPI.tokens.clearOverride?.(...)`).
     */
    clearOverride?: (flintId: string) => Promise<void>

    /**
     * Inserts or replaces a single property row in `component_overrides`.
     * Called by PropertiesPanel after every style / textContent commit to
     * set an export lock on the specific overridden property.
     *
     * @param flintId      — `data-flint-id` of the mutated element.
     * @param propertyKey   — Name of the overridden prop (e.g. `"style"`, `"textContent"`).
     * @param propertyValue — Serialised new value stored for audit / diffing.
     *
     * Optional-chained by callers (`window.flintAPI.tokens.upsertOverride?.(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    upsertOverride?: (flintId: string, propertyKey: string, propertyValue: string) => Promise<void>

    /**
     * Returns all rows in `component_overrides`, ordered by `updated_at` DESC.
     * Called by `ExportModal` during the pre-flight audit to list every
     * property override that is blocking the export gate (Commandment 6).
     */
    readOverrides?: () => Promise<OverrideRow[]>

    /**
     * MINT.2a: Scans project files (.tsx/.jsx/.css) for CSS variable references
     * to design tokens. Returns per-token usage counts for dead-token detection
     * and usage intelligence badges in TokenPanel.
     */
    scanUsage?: () => Promise<TokenUsageResult[]>

    /**
     * MINT.3a: Audits all color token foreground/background pairs for WCAG contrast.
     * Returns an array of contrast pair results with pass/fail for AA and AAA.
     */
    auditContrast?: () => Promise<ContrastPair[]>

    /**
     * MINT.3c: Returns pending tokens awaiting approval from `.flint/pending-tokens.json`.
     */
    getPendingApprovals?: () => Promise<PendingToken[]>

    /**
     * MINT.3c: Approves a pending token, moving it into design-tokens.json.
     */
    approveToken?: (tokenName: string) => Promise<{ ok: boolean }>

    /**
     * MINT.3c: Rejects a pending token, removing it from the pending list.
     */
    rejectToken?: (tokenName: string) => Promise<{ ok: boolean }>

    /**
     * MINT.5 Phase 1.2: Returns the list of design tokens whose local value
     * differs from the value declared in .flint/figma-tokens.json.
     *
     * The diff is computed server-side (main process reads both the SQLite
     * design_tokens table and the JSON file) so the renderer receives a single
     * resolved payload — no renderer-side JSON parsing, no render loop.
     *
     * Returns [] when figma-tokens.json is missing (no Figma sync yet) or
     * when local and remote values are identical. Invalid JSON in the file
     * also yields [] (graceful degradation with a warn log in main).
     *
     * deltaE is populated for color tokens (CIEDE2000) and undefined for all
     * other types — Phase 2 can threshold > 2.0 to amber without a round-trip.
     */
    readFigmaDrift?: () => Promise<TokenDrift[]>

    /**
     * MINT.5 Phase 1.5: Push-channel listener for token approvals.
     * Fires when a token is approved via either:
     *   - Glass UI (tokens:approve-token IPC, source="glass")
     *   - MCP tool flint_approve_tokens (source="mcp")
     *
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onTokenApproved?: (callback: (event: TokenApprovedEvent) => void) => () => void
}

/**
 * MINT.5 Phase 1.2: A single token drift row returned by tokens:read-figma-drift.
 *
 * tokenName matches DesignToken.token_path.
 * localValue is the value stored in the project's design_tokens SQLite table.
 * figmaValue is the value declared in .flint/figma-tokens.json.
 * deltaE is CIEDE2000 perceptual distance for color tokens; undefined for others.
 */
export interface TokenDrift {
    tokenName: string
    localValue: string
    figmaValue: string
    deltaE?: number
}

/**
 * MINT.5 Phase 1.5: Event body for the governance:on-token-approved push channel.
 * source distinguishes Glass-side approvals from MCP-path approvals so listeners
 * can render different flash animations without creating a feedback loop.
 */
export interface TokenApprovedEvent {
    tokenName: string
    source: 'glass' | 'mcp'
    /** Unix epoch milliseconds. */
    timestamp: number
}

/**
 * MINT.3a: A contrast pair result from the WCAG contrast audit.
 * Compares a foreground color token against a background color token.
 */
export interface ContrastPair {
    /** Foreground token path. */
    fg: string
    /** Background token path. */
    bg: string
    /** Foreground hex value. */
    fgValue: string
    /** Background hex value. */
    bgValue: string
    /** WCAG contrast ratio (e.g. 4.5). */
    ratio: number
    /** True if ratio >= 4.5 (WCAG AA normal text). */
    passAA: boolean
    /** True if ratio >= 7.0 (WCAG AAA normal text). */
    passAAA: boolean
}

/**
 * MINT.3c: A pending token awaiting approval before merging into design-tokens.json.
 */
export interface PendingToken {
    /** Token name/path, e.g. "color.brand.accent". */
    name: string
    /** Token value, e.g. "#ff6600". */
    value: string
    /** W3C DTCG type. */
    type: string
    /** Where this token came from, e.g. "Figma", "Scout", "Manual". */
    source: string
    /** ISO 8601 timestamp when the token was proposed. */
    proposedAt: string
}

/**
 * MINT.2a: Result of scanning project files for design token CSS variable usage.
 * Each entry maps a design token to its usage count across project files.
 */
export interface TokenUsageResult {
    /** The token name/path, e.g. "color-brand-primary" */
    tokenName: string
    /** The CSS variable name, e.g. "--color-brand-primary" */
    cssVar: string
    /** Number of files referencing this CSS variable */
    usageCount: number
    /** Relative file paths that reference this token */
    files: string[]
}

/**
 * A single row from the `component_overrides` SQLite table.
 * Represents one manually-overridden property on a specific element.
 */
export interface OverrideRow {
    /** The `data-flint-id` of the element with an active override. */
    flint_id: string
    /** The overridden property name, e.g. `"style"` or `"textContent"`. */
    property_key: string
    /** The serialised override value stored for audit / diffing. */
    property_value: string
    /** Unix timestamp (seconds) of the last write. */
    updated_at: number
}

// ── Strategy 7: Deferred Violation Row ────────────────────────────────────

/**
 * A single row from the `deferred_violations` SQLite table.
 * Represents a violation the user has explicitly deferred to a later session.
 */
export interface DeferredViolationRow {
    id: number
    file_path: string
    rule_id: string
    node_id: string | null
    reason: string | null
    duration: string | null
    expires_at: string | null
    session_id: string
    deferred_at: string
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
 * A single row returned by `window.flintAPI.readPresence()`.
 * Matches the SQLite `presence` table schema exactly (snake_case columns).
 * `updated_at` is a Unix timestamp (seconds since epoch).
 */
export interface PresenceRow {
    /** Session UUID — matches the sender's presenceSessionId. */
    id: string
    /** Display handle, e.g. "User-A3F2". */
    user_id: string
    /** Flint ID of the element being dragged / selected, or '' when idle. */
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
    /** Flint ID of the currently selected layer, or '' if nothing is selected. */
    nodeId?: string
    /** Cursor X coordinate in canvas space. */
    x: number
    /** Cursor Y coordinate in canvas space. */
    y: number
}

/**
 * A node in the recursive file tree returned by `window.flintAPI.openFolder()`.
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
 * A row from the `recent_projects` table in `flint-registry.db`.
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

/** IPC surface for the global flint-registry.db (Launch Screen). */
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
    /** Re-indexes the component registry and RAG store for the current project. */
    reindex?: () => Promise<void>
}

// ── FORGE.2a: Project Environment Detection ─────────────────────────────────

/**
 * Detected project environment returned by `project:detect-environment`.
 * Summarises the UI framework, CSS framework, token format, TypeScript usage,
 * and component library detected in the active project root.
 */
export interface ProjectEnvironment {
    // ── FORGE.2a enhanced fields ──────────────────────────────────────────
    /** Detected UI framework with name and version (e.g. { name: 'react', version: '19.1.0' }). */
    framework: { name: string; version: string } | null
    /** Detected CSS framework with name and version. */
    cssFramework: { name: string; version: string } | null
    /** Detected component library with name and version. */
    componentLibrary: { name: string; version: string } | null
    /** True when any design token file is found. */
    hasDesignTokens: boolean
    /** Source of design tokens when detected. */
    tokenSource: 'flint' | 'style-dictionary' | 'tokens-studio' | null
    /** Number of component files (.tsx/.vue/.svelte) found under src/. */
    componentCount: number

    // ── Legacy fields (backward-compat with DetectionBanner) ──────────────
    /** UI framework detected from package.json (e.g. 'React 19', 'Vue 3', 'Unknown'). */
    uiFramework: string
    /** Human-readable CSS framework label (e.g. 'Tailwind v4'). */
    cssFrameworkLabel: string
    /** Token format detected from project files (e.g. 'DTCG', 'Tokens Studio', null). */
    tokenFormat: string | null
    /** Whether TypeScript is configured (tsconfig.json present). */
    typescript: boolean
    /** Human-readable component library name (e.g. 'shadcn/ui', 'MUI', null). */
    componentLibraryLabel: string | null
    /** ISO 8601 timestamp when detection ran. */
    detectedAt: string
    /** Optional baseline audit summary, present when MCP was connected at detection time. */
    auditSummary?: { violations: number; grade: string }
}

/** IPC surface for project lifecycle operations (Phase G). */
export interface ProjectAPI {
    /**
     * Scaffolds a new Flint workspace by copying a bundled template into an
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
     * Resets an existing project to the known-good 'flint-demo' state.
     * Overwrites existing files within targetPath.
     */
    resetToDemo: (targetPath: string) => Promise<FileTreeNode>

    /**
     * Instantly scaffolds a new project at ~/Flint Projects/Untitled-N with
     * no folder picker dialog. The first free counter slot is chosen so names
     * never collide. Returns the FileTreeNode tree rooted at the new directory.
     *
     * One click → canvas. No dialogs.
     */
    createScratchpad: (payload?: { libraryDefault?: string }) => Promise<FileTreeNode>

    /**
     * CK.3: Re-scans the active project for React components via Babel AST,
     * merges the result into flint-manifest.json, and re-seeds the RAG store
     * so that flint_search_design_system reflects the latest project state.
     *
     * Returns `{ components, ragChunks }`. Both are 0 when no project is open.
     */
    reindex: () => Promise<{ components: number; ragChunks: number }>

    /**
     * Walks up the directory tree from `filePath` looking for a project root
     * (a directory that contains `package.json` or `.flint/`).
     *
     * Returns the absolute path of the project root, or `null` if none is found
     * before reaching the home directory.
     */
    findRootForFile: (filePath: string) => Promise<string | null>

    /**
     * FORGE.2a: Detects the project environment (UI framework, CSS framework,
     * token format, TypeScript, component library) by reading package.json
     * and checking for config files.
     *
     * Also writes the result to `.flint/detected-environment.json` (FORGE.2b)
     * and optionally runs a baseline audit if MCP is connected (FORGE.2c).
     *
     * Returns `null` when no project is open.
     */
    detectEnvironment: () => Promise<ProjectEnvironment | null>

    /**
     * FORGE.2b: Reads .flint/detected-environment.json and calls MCP tools to
     * configure the project. Calls flint_set_library (when a component library
     * was detected) and flint_reindex_registry. All MCP calls are best-effort.
     * Returns { configured: false } when MCP is not connected or no project is open.
     */
    autoConfigureProject: (payload?: {
        overrides?: {
            framework?: string
            componentLibrary?: string
            cssFramework?: string
        }
    }) => Promise<{ configured: boolean; library: string | null; reindexed: boolean }>

    /**
     * FORGE.4b: Reads the cached debt snapshot for a project and returns
     * its health grade letter, numeric score, and last-updated timestamp.
     * Returns null when the snapshot file is missing or malformed.
     */
    getHealthGrade?: (projectPath: string) => Promise<{ grade: string; score: number; updatedAt: string } | null>

    /**
     * FORGE.2c: Runs a full project-wide audit via flint_swarm_audit_fix,
     * then fetches the debt report via flint_debt_report, and writes the
     * result to .flint/debt-snapshot.json.
     *
     * Progress is emitted via `onBaselineProgress`. Returns null when no
     * project is open or MCP is not connected.
     */
    runBaseline?: () => Promise<{ violations: number; grade: string; score: number; filesAudited: number } | null>

    /**
     * Web mode only: returns the server's current activeProjectRoot so Glass can
     * auto-open the project on startup without requiring the user to select a folder.
     * Useful when `--project` is passed to the dev:web CLI.
     */
    getActiveRoot?: () => Promise<{ projectRoot: string }>

    /**
     * FORGE.2c: Subscribes to progress events emitted during `runBaseline`.
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onBaselineProgress?: (callback: (data: { phase: string; percent: number }) => void) => () => void

    /**
     * FORGE.1: "Start from existing code" smart-open channel.
     *
     * Accepts either an absolute folder path or a git URL (https://, git@, ssh://).
     * The main process heuristic-routes:
     *   - git URL  → git clone via GitManager (Commandment 14) → detect environment
     *   - folder   → detect environment directly
     *
     * The caller renders DetectionPreview from the returned environment before
     * calling project:auto-configure to commit the configuration.
     *
     * @param input — Absolute folder path or git URL. Validated by projectSmartOpenSchema (min 1).
     * @returns SmartOpenResult with projectPath, detected environment, and routing source.
     */
    smartOpen: (input: string) => Promise<{
        projectPath: string
        /** Full ProjectEnvironment — typed as unknown here; callers narrow at DetectionPreview boundary. */
        environment: ProjectEnvironment
        source: 'folder' | 'git-clone'
    }>
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
    /** Registers a callback for Help → Reset to First Launch… */
    onResetState: (callback: () => void) => void
    /** Removes all listeners for all menu channels. Call in useEffect cleanup. */
    removeMenuListeners: () => void
}

/**
 * A single entry in the git shadow commit log for a file.
 * Returned by `window.flintAPI.gitLog(filePath)`.
 */
export interface GitLogEntry {
    /** Abbreviated git commit hash (7 chars). */
    hash: string
    /** Commit message, e.g. "flint:sync:uuid". */
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
 * Extended FigmaStatus -- adds port so the renderer can render
 * copy-to-clipboard buttons without hardcoding values.
 *
 *   running       — true when the loopback ingestion server is bound and listening.
 *   lastWebhookAt — Unix timestamp (ms) of the last successful POST /ingest,
 *                   or null if no ingest has occurred in this process lifetime.
 *   tokenCount    — Current row count in the design_tokens SQLite table.
 *   port          — The port the ingestion server is actually listening on
 *                   (may differ from 4545 if port was busy).
 *
 * SEC.2: The secret field has been removed. The webhook secret is server-side only
 * and is never exposed to the renderer process.
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
     * Subscribes to 'flint:figma-connected' push events fired by the
     * ingestion server after each successful POST /ingest.
     *
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onConnected: (callback: (event: FigmaConnectedEvent) => void) => () => void

    /**
     * Subscribes to 'flint:figma-error' push events fired by the
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
    /** Persist the full AI config (API key, provider, model, baseURL) to ~/.flint/config.json. */
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
    /** CK.1: Re-seed the RAG store from the active project's manifest, tokens, and docs. */
    seedRAG?: () => Promise<{ ingested: number; sources: string[] }>
}

// ── Phase COLLAB.4: Annotation Types ──────────────────────────────────────────
// Renderer-side mirror of flint-mcp/src/core/annotations/types.ts.
// Kept in sync manually — cross-boundary imports are prohibited by the
// two-tsconfig architecture.

/** The set of annotation categories supported by flint_annotate (COLLAB.3). */
export type AnnotationType = 'note' | 'decision' | 'approval' | 'handoff'

/** Resolution status of an annotation. */
export type AnnotationStatus = 'open' | 'resolved'

/**
 * A single Flint annotation anchoring a structured comment to a node.
 *
 * id         — Stable UUID. Never changes after creation.
 * nodeId     — The data-flint-id of the anchored JSX element.
 * filePath   — Absolute path to the file containing the anchored element.
 * type       — Category (note | decision | approval | handoff).
 * author     — Display name of the annotation author.
 * body       — The human-readable annotation content.
 * status     — 'open' (default) or 'resolved'.
 * visibility — 'public' (default) or 'private'.
 * createdAt  — ISO 8601 timestamp of creation.
 * resolvedAt — ISO 8601 timestamp when resolved, or null.
 */
export interface FlintAnnotation {
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
 * Exposed as `window.flintAPI.annotations`.
 */
export interface AnnotationsAPI {
    /**
     * Returns all annotations from .flint/annotations.json.
     * Returns [] when the file is missing or unparseable (safe default).
     */
    readAll: () => Promise<FlintAnnotation[]>

    /**
     * Marks the annotation with `id` as resolved. Writes the updated list
     * back to .flint/annotations.json atomically via tmp→rename.
     * No-ops silently if the id does not exist.
     */
    resolve: (id: string) => Promise<void>

    /**
     * Registers `cb` to be called whenever .flint/annotations.json changes
     * on disk (via main-process fs.watch). The callback receives no arguments —
     * callers should invoke fetchAnnotations() in response.
     *
     * Call `removeChangedListener()` in a useEffect cleanup to prevent leaks.
     */
    onChanged: (cb: () => void) => void

    /** Removes all 'flint:annotations-changed' listeners. */
    removeChangedListener: () => void
}

// ── Phase W: MCP Push Channel + Bidirectional Action Flint ──────────────────

/**
 * Event types that the MCP server appends to `.flint/mcp-events.jsonl`
 * after each tool completion.
 */
export type MCPEventType = 'violation' | 'annotation' | 'mutation' | 'audit' | 'fix' | 'debt' | 'context-delta' | 'file:focus'

/** Severity levels for MCPEvent — drives notification styling in Glass. */
export type MCPEventSeverity = 'critical' | 'warning' | 'info'

/**
 * A single event record appended to `.flint/mcp-events.jsonl` by the MCP
 * server and tail-followed by the Electron main process.
 *
 * timestamp — Unix timestamp in milliseconds.
 * type      — Category of event (violation, annotation, mutation, etc.).
 * severity  — Drives toast colour and notification priority.
 * summary   — Human-readable one-line description for the Glass toast.
 * nodeId    — Optional `data-flint-id` of the affected JSX element.
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

/**
 * Discriminated union for MCP call result classification (MINT.5 Phase 3).
 * Computed in `electron/mcpClient.ts` and `server/mcpClient.ts` before the
 * result reaches any renderer consumer. Single source in `shared/mcp-classification.ts`.
 *
 * - `'auth-expired'`     — Figma OAuth token expired or revoked.
 * - `'rate-limited'`     — Upstream API rate limit hit (429 / too many requests).
 * - `'network-error'`    — Network unreachable, DNS failure, ECONNREFUSED.
 * - `'tool-error'`       — Tool ran but returned isError=true with a domain message.
 * - `'validation-error'` — Renderer preload Zod gate rejected the call (no IPC fired).
 * - `'unknown'`          — No classifier matched, or the call succeeded.
 */
export type MCPCallClassification =
    | 'auth-expired'
    | 'rate-limited'
    | 'network-error'
    | 'tool-error'
    | 'validation-error'
    | 'unknown'

/** Result of an MCP tool call — mirrors MCP CallToolResult schema. */
export interface MCPCallResult {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
    /**
     * Structured classification of the result (MINT.5 Phase 3).
     * Optional so legacy code paths that haven't been updated degrade gracefully.
     * Main process attaches `'unknown'` for success, a specific class for errors.
     * Phase 4 will tighten this to required.
     */
    classification?: MCPCallClassification
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
 * Exposed as `window.flintAPI.mcp`.
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
     * Resets the crash counter and re-spawns the MCP server child process.
     * Safe to call when connected (will stop + restart) or disconnected.
     * Resolves immediately — connection happens asynchronously.
     */
    reconnect: () => Promise<void>

    /**
     * Subscribes `callback` to `flint:mcp-event` push events.
     * Events are batched within a 500ms window before dispatch.
     * Call `removeEventListener()` in useEffect cleanup to prevent leaks.
     */
    onEvent: (callback: (events: MCPEvent[]) => void) => void

    /** Removes all `flint:mcp-event` listeners. Call in useEffect cleanup. */
    removeEventListener: () => void

    /** Phase 3: Returns the filePath of the most recent file:focus event within
     *  the last 60 seconds across all known projects, or null if none. */
    getRecentFileFocus: () => Promise<string | null>
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
 * Summary pushed from main → renderer via 'flint:import-summary' IPC.
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

/** IPC surface for the ingestion heal pass (window.flintAPI.importSummary). */
export interface ImportSummaryAPI {
    onSummary: (callback: (summary: IngestionSummary) => void) => () => void
    snapToToken: (payload: SnapToTokenPayload) => Promise<{ ok: boolean; updatedSummary?: IngestionSummary }>
    undoAllHeals: (preHealCode: string) => Promise<{ ok: boolean }>
    removeListeners: () => void
}

// ── Phase ACX.5: Context Sync Types ──────────────────────────────────────────

/**
 * Live state snapshot written to `.flint/context.json` by `useContextSync`
 * every 200 ms (debounced). The MCP server reads this file via
 * `flint_get_context` / `flint://context` to stay synchronized with the
 * visual Glass layer without requiring direct IPC coupling.
 *
 * All new fields are optional for backward compatibility — older context.json
 * files written before ACX.5 will still parse correctly.
 *
 * Context Flint Awareness (CLAUDE.md §8): any new Glass state that should
 * be visible to the MCP server must be added to this type AND populated in
 * `useContextSync`.
 */
export interface FlintContext {
    /** Unix timestamp (ms) of when this snapshot was assembled. */
    timestamp: number

    /** Absolute path of the currently open file, or null. */
    activeFile: string | null

    /** data-flint-id of the selected node, or null. */
    selectedNodeId: string | null

    /** Cursor position in the source editor, or null. */
    cursorPosition: { line: number; column: number } | null

    /** Aggregated violation counts for the current file. */
    violations: {
        mithrilCount: number
        a11yCount: number
        criticalCount: number
        /** All data-flint-ids that have at least one violation. */
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
     * `flint_read_code` call. Null when no file is open.
     */
    sourceExcerpt?: string | null

    /**
     * Descriptor of the currently selected node.
     * Null when no node is selected.
     */
    selectedNodeSummary?: {
        tagName: string
        flintId: string
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

    // ── Strategy 2/4: Session Persona + Summary ──────────────────────────────

    /**
     * Persona inferred from the user's first message.
     * Set by the MCP prompt layer via context file. Null until classified.
     */
    sessionPersona?: 'designer' | 'developer' | null

    // ── LIB.1: Active Library Context ────────────────────────────────────────

    /**
     * The currently selected component library for this project.
     * Read from .flint/policy.json selectedLibrary field.
     * Null when no library is selected.
     */
    selectedLibrary?: string | null
}

/**
 * Enriched context returned by `context:get-enriched` IPC.
 * Extends the raw FlintContext snapshot with live SQLite metrics
 * assembled in the main process: token count, override count, health score.
 *
 * Used by ACX.1 `sessionContext.ts` to assemble `flint://session-context`.
 */
export interface EnrichedContext extends FlintContext {
    /** Total design token count from the design_tokens table. */
    tokenCount: number
    /** Number of active export-blocking overrides in component_overrides. */
    activeOverrideCount: number
    /** ISO 8601 UTC timestamp of when this enriched snapshot was assembled. */
    enrichedAt: string

    // ── RUNTIME.1: Feature flag surface ───────────────────────────────────────
    //
    // Session-context surface for feature flags. Piggybacks on the existing
    // `flint_get_context` channel rather than adding a new IPC per flag
    // (contract decision #7). Missing key → treated as false (safe default).
    /**
     * Feature flag payload. Each entry is read by a corresponding `use*Flag`
     * hook in the renderer. Absence of a key is always treated as `false`
     * to preserve the safe-default posture.
     */
    features?: {
        /** RUNTIME.1 `runtime.axe.enabled` — hidden by default on first ship. */
        runtimeAxeEnabled?: boolean
    }
}

// ── Phase CV2.3: Component Cards on Canvas ────────────────────────────────────

/**
 * Category of a component, derived from its file path convention.
 *
 * Derivation rules (applied by the `components:list` IPC handler):
 *   path contains /primitives/ or /atoms/  → 'primitive'
 *   path contains /molecules/              → 'molecule'
 *   path contains /organisms/ or /templates/ → 'organism'
 *   path contains /pages/                  → 'page'
 *   path contains /layouts/               → 'layout'
 *   anything else                          → 'uncategorized'
 *
 * The manifest can optionally include an explicit `category` field that
 * overrides this derivation.
 */
export type ComponentCategory =
    | 'primitive'
    | 'molecule'
    | 'organism'
    | 'page'
    | 'layout'
    | 'uncategorized'

/**
 * Governance health snapshot for a single component.
 * Populated by `flint_audit` results (CV2.4). Null until the first audit runs.
 */
export interface ComponentHealth {
    /** Health grade letter: A (clean) through F (critical). */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Maximum CIEDE2000 Delta-E value found in this component. */
    maxDeltaE: number
    /** Total violation count (Mithril + A11y). */
    violationCount: number
    /** Mithril (design token drift) violations only. */
    mithrilCount: number
    /** Accessibility violations only. */
    a11yCount: number
}

/**
 * Data shape for a single component card on the canvas.
 * Assembled by the `components:list` IPC handler from flint-manifest.json.
 *
 * id          — Stable deterministic hash of (name + importPath). Survives sessions.
 * name        — Component display name, e.g. "Button", "Card".
 * importPath  — Import path, e.g. "@/components/ui/Button".
 * filePath    — Resolved absolute file path on disk.
 * category    — Derived from file path convention (see ComponentCategory).
 * variantCount — Number of variants from the manifest (0 when no variants).
 * variants     — Variant names from the manifest (e.g. ["default", "ghost", "outline"]).
 *                Parallel to variantCount — variants.length === variantCount.
 * props       — Props table from the manifest.
 * thumbnailPath — Absolute path to .flint/thumbnails/<id>.png, or null if not generated.
 * health      — Governance health data (Govern mode). Null when not yet computed (CV2.4).
 * tokens      — Design token paths this component consumes.
 * dependencies — Import paths of components this component imports (dependency edges).
 */
export interface ComponentCardData {
    id: string
    name: string
    importPath: string
    filePath: string
    category: ComponentCategory
    variantCount: number
    /** Variant names sourced from the manifest. Parallel to variantCount. */
    variants: string[]
    props: Record<string, { type: string; required: boolean }>
    thumbnailPath: string | null
    health: ComponentHealth | null
    tokens: string[]
    dependencies: string[]
}

/**
 * IPC surface for component card operations (Phase CV2.3).
 * Exposed as `window.flintAPI.components`.
 */
export interface ComponentsAPI {
    /**
     * Returns all indexed components for the active project.
     * Reads flint-manifest.json, derives categories and thumbnail paths,
     * and returns ComponentCardData[] sorted by category then name.
     *
     * Returns [] when no flint-manifest.json is found (new projects).
     */
    list: () => Promise<ComponentCardData[]>

    /**
     * Persists card spatial positions to .flint/card-positions.json via
     * FileTransactionManager (atomic tmp→rename). Called by savePositions()
     * in componentCardStore — debounced at 500 ms.
     */
    savePositions: (positions: Record<string, { x: number; y: number }>) => Promise<void>

    /**
     * Loads persisted card positions from .flint/card-positions.json.
     * Returns {} if the file does not exist (first open, or manual delete).
     */
    loadPositions: () => Promise<Record<string, { x: number; y: number }>>

    /**
     * CV2.6: Persists a user-defined category override for a single component.
     * Writes to .flint/category-overrides.json via FileTransactionManager.
     * The next `list()` call will return the overridden category instead of the
     * auto-derived one.
     *
     * @param payload.componentId — Stable hash ID of the component (from list()).
     * @param payload.category    — Target ComponentCategory value.
     */
    setCategory: (payload: { componentId: string; category: ComponentCategory }) => Promise<void>
}

// ── Phase CV2.2: Component Thumbnail Generator ────────────────────────────────

/**
 * IPC surface for component thumbnail generation and retrieval.
 * Phase CV2.2: Thumbnails are static PNGs rendered via offscreen
 * BrowserWindow capture, cached in .flint/thumbnails/.
 *
 * Pull-based only — no push events. The renderer requests when it needs one.
 * Component names are sanitized in the main process to prevent path traversal.
 */
export interface ThumbnailsAPI {
    /**
     * Generate a thumbnail for a single component file.
     * Returns a cache hit immediately if a valid PNG exists in .flint/thumbnails/.
     * Otherwise renders the component in a hidden BrowserWindow and saves the PNG.
     *
     * Returns the result with the thumbnail path or an error description.
     */
    generate: (payload: {
        filePath: string
        componentName: string
        width?: number
        height?: number
    }) => Promise<{
        componentName: string
        thumbnailPath: string
        generated: boolean
        error: string | null
    }>

    /**
     * Batch generate thumbnails for all components in flint-manifest.json.
     * Processes sequentially to avoid GPU contention.
     * Returns aggregate results with per-component detail.
     */
    generateAll: () => Promise<{
        total: number
        succeeded: number
        failed: number
        results: Array<{
            componentName: string
            thumbnailPath: string
            generated: boolean
            error: string | null
        }>
    }>

    /**
     * Read a cached thumbnail as a base64 data URL string.
     * Returns null if the thumbnail is not cached (caller should generate first).
     * Serving cached thumbnails from disk targets < 50ms.
     */
    get: (componentName: string) => Promise<string | null>

    /**
     * Invalidate (delete) the cached thumbnail for a specific component.
     * Called automatically when a component file is saved via FileTransactionManager.
     * Can also be called manually for force-refresh.
     */
    invalidate: (componentName: string) => Promise<void>
}

// ── Phase REM.2.1: Governance Autopilot types ─────────────────────────────────

/**
 * Result broadcast from main → renderer after each Governance Autopilot audit.
 * Contains the governed (post-dry-run-fix) source and violation counts so the
 * renderer can display the diff without another round-trip.
 */
export interface AutopilotResult {
    /** Absolute path of the file that was audited. */
    filePath: string
    /** The source code after the dry-run fix pass (may equal the original if no fixes apply). */
    governedSource: string
    /** Total number of fixable violations found in the dry-run. */
    fixableCount: number
    /** Number of Mithril (design token drift) violations found. */
    mithrilCount: number
    /** Number of accessibility violations found. */
    a11yCount: number
    /** Unix timestamp (ms) when this result was produced. */
    timestamp: number
}

/**
 * IPC surface for the Governance Autopilot (Phase REM.2.1).
 * Exposed as `window.flintAPI.autopilot`.
 */
export interface AutopilotAPI {
    /**
     * Enables the autopilot for `filePath`. Immediately runs an audit and then
     * watches the file for subsequent saves (500 ms debounce). Each audit
     * broadcasts an AutopilotResult via `onResult`.
     *
     * Calling enable() while already enabled replaces the previous watcher.
     */
    enable: (filePath: string) => Promise<void>

    /**
     * Disables the autopilot and tears down the file watcher.
     * Safe to call when not enabled (idempotent).
     */
    disable: () => Promise<void>

    /**
     * Registers `callback` to be called whenever a new AutopilotResult is
     * available. Returns an unsubscribe function — pass it to useEffect cleanup
     * to prevent listener accumulation.
     */
    onResult: (callback: (result: AutopilotResult) => void) => () => void
}

// ── CR.4: Component Scope Management ──────────────────────────────────────────

/**
 * A single component entry from flint-manifest.json, as surfaced to the
 * renderer. This is the renderer-side mirror of the orchestrator's RegistryEntry
 * with normalized field names (consumedTokens instead of tokens array).
 */
export interface ComponentRegistryEntry {
    name: string
    props: Record<string, { type: string; required: boolean }>
    variants: string[]
    consumedTokens: string[]
    description: string
    /** Canonical usage code snippet. Present after enrichment draft approval. */
    usageExample?: string
}

/**
 * Combined registry + scope snapshot returned by scope:get-registry-and-scope.
 * A single IPC round-trip returns everything the scope panel needs.
 */
export interface ComponentScopeData {
    /** All components from flint-manifest.json, keyed by component name. */
    registry: Record<string, ComponentRegistryEntry>
    /**
     * Current componentScope from .flint/policy.json.
     * null = no scope set (all components allowed, CR.3 backward compat).
     * string[] = explicit allow-list of component names.
     */
    scope: string[] | null
    /** True when flint-manifest.json was found and parsed successfully. */
    registryAvailable: boolean
}

/**
 * Payload for scope:set-scope IPC.
 */
export interface ComponentScopeUpdate {
    /**
     * null = remove scope restriction (all components allowed).
     * string[] = set explicit allow-list. Empty array = treated as null.
     */
    scope: string[] | null
}

/**
 * A single pending enrichment draft produced by the MCP enrichment pipeline.
 * Stored in .flint/enrichment-drafts.json, keyed by component name.
 */
export interface EnrichmentDraft {
    /** Human-readable summary of what the component does. */
    description: string
    /** Short code snippet showing a canonical usage of the component. */
    usageExample: string
    /** Optional notes on how this component composes with siblings/parents. */
    compositionNotes?: string
    /** Optional WCAG / accessibility guidance specific to this component. */
    a11yNotes?: string
    /** Other component names commonly used alongside this one. */
    relatedComponents?: string[]
    /** Pipeline confidence level for this draft. */
    confidence: 'high' | 'medium' | 'low'
    /** Number of project files in which this component appears. */
    usageFileCount: number
    /** Relative path to the component's primary source file. */
    sourceFile: string
    /** ISO-8601 timestamp when this draft was generated. */
    generatedAt: string
    /** Identifier for the process/model that generated this draft. */
    generatedBy: string
}

/**
 * Computed enrichment coverage stats for the active project.
 * Returned alongside drafts by `enrichment:get-drafts`.
 */
export interface EnrichmentStats {
    /** Components in the manifest with no description or usageExample and no pending draft. */
    bare: number
    /** Components with a pending enrichment draft awaiting approval. */
    draft: number
    /** Components that have both description AND usageExample in the manifest. */
    enriched: number
    /** Total component count in flint-manifest.json. */
    total: number
}

/**
 * IPC surface for enrichment draft management (EN.1).
 * Exposed as window.flintAPI.enrichment.
 */
export interface EnrichmentAPI {
    /**
     * Returns all pending enrichment drafts from .flint/enrichment-drafts.json
     * together with computed enrichment stats derived from flint-manifest.json.
     * Returns null when no project is open.
     */
    getDrafts: () => Promise<{ drafts: Record<string, EnrichmentDraft>; enrichmentStats: EnrichmentStats } | null>

    /**
     * Approves or dismisses a single enrichment draft.
     *
     * 'approve' — merges the draft fields (plus any renderer-edited overrides)
     *   into flint-manifest.json via FileTransactionManager, then triggers a
     *   RAG re-seed so the updated description is immediately queryable.
     *
     * 'dismiss' — removes the draft from enrichment-drafts.json without
     *   touching the manifest.
     *
     * Returns remainingDrafts so callers can update their badge counts without
     * a follow-up getDrafts() round-trip.
     */
    approve: (payload: {
        componentName: string
        action: 'approve' | 'dismiss'
        editedFields?: Record<string, unknown>
    }) => Promise<{ ok: boolean; remainingDrafts: number; error?: string }>
}

/**
 * IPC surface for component scope management (CR.4).
 * Exposed as window.flintAPI.scope.
 */
export interface ScopeAPI {
    /** Returns full registry + current scope in one round-trip. */
    getRegistryAndScope: () => Promise<ComponentScopeData>
    /** Persists scope changes to .flint/policy.json. */
    setScope: (update: ComponentScopeUpdate) => Promise<{ ok: boolean; error?: string }>
    /** LIB.1: Returns the currently selected library and available adapters. */
    getActiveLibrary: () => Promise<{ library: string | null; availableLibraries: Array<{ library: string; displayName: string }> }>
    /** LIB.1: Sets the active library, seeds tokens, returns result. */
    setActiveLibrary: (update: { library: string | null }) => Promise<{ ok: boolean; library: string | null; seeded: number; error?: string }>
}

// ── Phase D2C.2: Design-to-Code types ────────────────────────────────────────

/**
 * Request payload for the `d2c:apply` IPC channel.
 * Mirrors the shape of DesignToCodeResult from the flint_design_to_code MCP
 * tool but only carries the fields needed for file creation.
 *
 * The main process handler writes all files under:
 *   `<projectRoot>/src/components/generated/<pageName>/`
 */
export interface D2CApplyRequest {
    /** Page name used as the folder name under src/components/generated/ */
    pageName: string
    /** Section components to write as individual .tsx files */
    components: Array<{
        name: string
        code: string
    }>
    /** Page compositor that imports and assembles all sections */
    page: {
        name: string
        code: string
    }
    /** Optional theme file to write at the project root */
    themeFile?: {
        filename: string
        code: string
    }
}

/**
 * Response from the `d2c:apply` IPC channel.
 */
export interface D2CApplyResult {
    /** Whether all files were written successfully */
    ok: boolean
    /** Absolute path to the page compositor file — pass to setActiveFile() */
    pageFilePath: string
    /** Absolute paths of all written section component files */
    componentFilePaths: string[]
    /** Refreshed workspace file tree — pass to setWorkspaceFiles() */
    workspaceTree: FileTreeNode
    /** Error message when ok === false */
    error?: string
}

/**
 * IPC surface for the Design-to-Code apply pipeline (Phase D2C.2).
 * Exposed as `window.flintAPI.designToCode`.
 */
export interface DesignToCodeAPI {
    /**
     * Writes all generated component files to disk, runs injectFlintIds on each
     * component's AST (Commandment 7), shadow-commits the new files, re-scans
     * the workspace tree, and returns the page compositor path so the renderer
     * can call canvasStore.setActiveFile() to trigger LivePreview rendering.
     *
     * The apply is atomic: all files are written via FileTransactionManager.writeBatch
     * in a single operation. On failure, ok === false and error contains the reason.
     */
    apply: (request: D2CApplyRequest) => Promise<D2CApplyResult>
}

// ── Phase 0: Coverage Honesty types (renderer-side mirror of shared/coverage-types.ts) ─
//
// These are renderer-side mirrors of shared/coverage-types.ts. They must be
// kept in sync manually — cross-boundary imports are prohibited in ambient
// declaration files. If CoverageReason values are added to the shared type,
// add them here too.

/** Structured reason a file could not be fully governed. */
export type CoverageReason =
    | 'css-in-js-detected'
    | 'external-stylesheet-imported'
    | 'css-modules-reference'
    | 'dynamic-class-expression'
    | 'unresolvable-var'
    | 'tailwind-config-extension'
    | 'non-jsx-framework'
    | 'non-literal-ternary-branch'

/** Per-reason count map. Every CoverageReason key is present; absent reasons report 0. */
export type SkippedFilesByReason = Record<CoverageReason, number>

/**
 * Aggregate coverage shape returned by `flint:getCoverageSummary`, the
 * `flint_debt_report` MCP tool, `flint://dashboard`, and `flint://session-context`.
 *
 * Coverage is informational — it does NOT affect the A-F debt grade.
 */
export interface CoverageSummary {
    /** Governed-surface percentage: (parsedFiles / totalFiles) * 100, rounded to 1 dp. */
    governedSurfacePercent: number
    /** Every file the classifier saw, regardless of outcome. */
    totalFiles: number
    /** Count of files with status === 'parsed'. */
    parsedFiles: number
    /** Count of files with status === 'partial'. */
    partialFiles: number
    /** Count of files with status === 'skipped-unsupported'. */
    skippedFiles: number
    /** Files that were partial OR skipped, grouped by primary reason. */
    skippedFilesByReason: SkippedFilesByReason
    /** ISO 8601 UTC timestamp the summary was generated. */
    timestamp: string
}

export interface FlintAPI {
    /** Health-check: verifies the IPC flint is functional. */
    ping: () => Promise<string>

    /**
     * Shows the native OS directory picker and returns only the selected path
     * string (no scan). Used by the "New Project" flow to pick an empty target
     * directory before calling `project.initialize`.
     *
     * Returns `null` if the user cancels or selects outside their home dir.
     */
    selectFolder: () => Promise<string | null>

    /** Project Registry CRUD — backed by the global flint-registry.db. */
    registry: RegistryAPI

    /** Session restoration — used by App.tsx for auto-resume on launch. */
    session: {
        getLastSession: () => Promise<{ path: string; name: string; isScratchpad: boolean } | null>
    }

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
     * MFP.2: Compiles a Vue 3 SFC (.vue) source string into preview-ready JS.
     * Runs in the Electron main process via @vue/compiler-sfc.
     * Returns `{ js, css, error: null }` on success, `{ js: null, css: '', error }` on failure.
     */
    transformVue: (code: string) => Promise<{ js: string | null; css: string; error: string | null }>

    /**
     * MFP.3: Compiles a Svelte (.svelte) source string into self-contained vanilla JS.
     * Runs in the Electron main process via svelte/compiler.
     * Returns `{ js, css, error: null }` on success, `{ js: null, css: '', error }` on failure.
     */
    transformSvelte: (code: string) => Promise<{ js: string | null; css: string; error: string | null }>

    /**
     * Queries the Main Process for the current ingestion server state.
     * Call this before instructing the Figma plugin to begin sending assets.
     *
     * @example
     * const status = await window.flintAPI.getServerStatus()
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
     * Annotation read + resolve API — backed by .flint/annotations.json.
     * Written by MCP tools; read and resolved by Glass (COLLAB.4).
     *
     * Optional-chained by callers (`window.flintAPI.annotations?.readAll()`)
     * so Vitest / headless environments degrade gracefully.
     */
    annotations?: AnnotationsAPI

    // ── Phase N.4: Preview Engine ──────────────────────────────────────────────

    /** Programmatic Vite dev server API — agnostic preview engine. */
    preview: PreviewAPI
    // ── Phase W: MCP Push Channel + Bidirectional Action Flint ───────────────

    /**
     * MCP integration — push events from the MCP server + bidirectional tool invocation.
     *
     * Optional-chained by callers (`window.flintAPI.mcp?.callTool(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    mcp?: MCPAPI

    // ── GOV.1 + GOV.2: Governance Provenance + Override Telemetry ─────────────

    /**
     * Governance telemetry API — rule provenance lookup and override event recording.
     * Exposed as window.flintAPI.governance.
     */
    governance: GovernanceAPI

    /**
     * Delta Mode baseline API — snapshot current violations so Flint only
     * reports NEW issues going forward (Gap 6).
     *
     * Optional-chained by callers (`window.flintAPI.baseline?.set(...)`)
     * so Vitest / headless environments degrade gracefully.
     */
    baseline?: BaselineAPI

    /**
     * Governance Policy API — reads the configurable policy engine settings
     * from `.flint/policy.json` (Gap 3).
     *
     * Optional-chained by callers (`window.flintAPI.policy?.get()`)
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
     * Writes a FlintContext snapshot to `.flint/context.json` in the main
     * process. Called by `useContextSync` on every meaningful state change
     * (debounced at 200 ms). Fire-and-forget — the promise resolves when the
     * file write completes but the renderer does not need the result.
     *
     * This is the sole mechanism by which the MCP server learns about live
     * Glass state. Do not call `fs.writeFile` directly — route through this
     * IPC channel so the write goes through the main process.
     */
    syncContext: (context: FlintContext) => Promise<void>

    /**
     * Returns an enriched context snapshot assembled from `.flint/context.json`
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

    // ── Strategy 7: Deferred Violations ──────────────────────────────────────

    /**
     * @deprecated Use governance.deferViolation instead — this top-level alias
     * exists only for backward compatibility and will be removed in a future release.
     *
     * Defers a governance violation so the user can return to it later.
     * Upserts by (file, ruleId, nodeId) — deferring the same violation twice
     * refreshes the timestamp and reason.
     */
    deferViolation?: (file: string, ruleId: string, nodeId?: string, reason?: string, duration?: string) => Promise<void>

    /**
     * Returns all unresolved deferred violations (resolved_at IS NULL).
     * Used by GovernanceOverlay to show "Deferred" badges.
     */
    getDeferredViolations?: () => Promise<DeferredViolationRow[]>

    /**
     * Resolves a previously deferred violation by setting resolved_at.
     */
    resolveDeferredViolation?: (file: string, ruleId: string, nodeId?: string) => Promise<void>

    // ── Beta Distribution ────────────────────────────────────────────────────

    /**
     * Beta build API — expiry info, feedback submission, update notifications.
     * Optional-chained by callers so non-beta dev builds degrade gracefully.
     */
    beta?: BetaAPI

    // ── BETA.3: Auto-Update ───────────────────────────────────────────────────

    /**
     * electron-updater auto-update surface — check, download, install, channel management.
     * Optional-chained by callers so Vitest / headless environments degrade gracefully.
     */
    autoUpdate?: AutoUpdateAPI

    // ── ONBOARD.1: First-Launch Setup Wizard ─────────────────────────────────

    /**
     * Setup wizard IPC surface — IDE detection, first-launch flag read/write.
     * Added by the IPC agent (Group 1). Optional-chained by callers so
     * Vitest/headless environments degrade gracefully.
     */
    setup: {
        /** Detect which IDEs are installed by checking their settings file paths. */
        detectIDEs: () => Promise<{
            ides: Array<{
                name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
                settingsPath: string
                detected: boolean
            }>
            mcpServerPath: string
        }>
        /** Returns true when .flint/setup.json does not exist or lacks the flag. */
        checkFirstLaunch: () => Promise<{ isFirstLaunch: boolean }>
        /** Auto-write the Flint MCP entry into the IDE's config file. Merges — never clobbers. */
        writeMCPConfig: (ideName: string, configPath: string, mcpServerPath: string) => Promise<{ written: boolean }>
        /** Writes the first-launch-complete flag to ~/.flint/setup.json. */
        completeFirstLaunch: () => Promise<void>
        /** Deletes ~/.flint/setup.json so the next launch shows the full onboarding flow. */
        resetState: () => Promise<void>
    }

    // ── Phase REM.2.1: Governance Autopilot ───────────────────────────────────

    /**
     * Governance Autopilot API — watches the active file for saves, runs a
     * dry-run fix via flint_fix, and pushes the governed source back to the
     * renderer via onResult().
     *
     * Optional-chained by callers so Vitest / headless environments degrade
     * gracefully.
     */
    autopilot?: AutopilotAPI

    // ── Phase CV2.3: Component Cards on Canvas ─────────────────────────────────

    /**
     * Component card IPC surface — reads flint-manifest.json and persists
     * spatial positions. Consumed by componentCardStore.loadCards() and
     * savePositions().
     *
     * Optional-chained by callers so Vitest / headless environments degrade
     * gracefully.
     */
    components: ComponentsAPI

    // ── Phase CV2.2: Component Thumbnail Generator ────────────────────────────

    /**
     * Component thumbnail generation and retrieval (Phase CV2.2).
     * Thumbnails are static PNGs rendered via offscreen BrowserWindow capture,
     * cached in .flint/thumbnails/. All operations are pull-based.
     *
     * Optional-chained by callers so Vitest / headless environments degrade
     * gracefully.
     */
    thumbnails?: ThumbnailsAPI

    // ── CR.4: Component Scope Management ──────────────────────────────────────

    /**
     * Component scope management API — reads component registry and persists
     * scope changes to .flint/policy.json (CR.4).
     *
     * Optional-chained by callers (`window.flintAPI.scope?.getRegistryAndScope()`)
     * so Vitest / headless environments degrade gracefully.
     */
    scope?: ScopeAPI

    // ── EN.1: Enrichment Draft Reading and Approval ───────────────────────────

    /**
     * Enrichment draft management API — reads .flint/enrichment-drafts.json
     * and flint-manifest.json, and approves/dismisses individual drafts (EN.1).
     *
     * Optional-chained by callers (`window.flintAPI.enrichment?.getDrafts()`)
     * so Vitest / headless environments degrade gracefully.
     */
    enrichment?: EnrichmentAPI

    // ── File watcher (IPC channel: flint:file-changed) ───────────────────────

    /**
     * Subscribes to file-change events pushed by the workspace file watcher in
     * the main process. Fires whenever a tracked source file's mtime increases.
     * The renderer uses this to keep LivePreview in sync without polling.
     *
     * Call `removeFileChangedListener()` in cleanup to avoid duplicate listeners.
     */
    onFileChanged: (callback: (data: { filePath: string; content: string }) => void) => void

    /** Removes all listeners registered for the file-changed channel. */
    removeFileChangedListener: () => void

    // ── Phase Q: Asset Management Hub (optional) ─────────────────────────────

    /**
     * Asset metadata API — reads from the assets_cache SQLite table.
     * Optional-chained by callers.
     */
    assets?: AssetsAPI

    // ── GOV.2: Rule override persistence (optional) ──────────────────────────

    /** Persists governance rule overrides to .flint/rule-overrides.json. */
    saveRuleOverrides?: (payload: { version: 1; rules: Record<string, unknown> }) => Promise<void>

    /** Loads governance rule overrides from .flint/rule-overrides.json. */
    getRuleOverrides?: () => Promise<{ version: 1; rules: Record<string, unknown> } | null>

    // ── ActivityFeed file navigation (optional) ──────────────────────────────

    /** Opens a file in the host IDE / canvas. Optional. */
    openFile?: (filePath: string) => void

    // ── IDE→Glass File Sync ───────────────────────────────────────────────────

    /**
     * Registers a callback fired when the VS Code/Cursor extension changes the
     * active file. Glass uses this to auto-follow IDE focus.
     *
     * The callback receives either a raw string (Electron IPC) or an object
     * `{ path: string; explicit?: boolean }` (Web/WS). When `explicit` is
     * true the user invoked "Open in Flint Glass" deliberately — Glass should
     * load the file immediately without showing an acceptance toast.
     */
    onIDEFileSelected?: (cb: (data: string | { path: string; explicit?: boolean }) => void) => void | (() => void)

    /** Removes all `onIDEFileSelected` listeners. */
    removeIDEFileSelectedListener?: () => void

    /**
     * Fires when the server's active project changes externally (e.g. via
     * the demo script or a CLI curl call). Glass uses this to re-open the
     * correct project so IDE sync paths are accepted.
     */
    onProjectOpened?: (cb: (data: { path: string }) => void) => (() => void)

    /** Removes all `onProjectOpened` listeners. */
    removeProjectOpenedListener?: () => void

    // ── Phase D2C.2: Design-to-Code LivePreview Integration ───────────────────

    /**
     * Design-to-code pipeline integration — atomically writes all generated
     * component files to disk, runs injectFlintIds, shadow-commits, and rescans
     * the workspace tree so LivePreview can render the page compositor immediately.
     *
     * Optional-chained by callers (`window.flintAPI.designToCode?.apply(...)`)
     * so Vitest / headless environments (older preload versions) degrade gracefully.
     */
    designToCode?: DesignToCodeAPI

    /**
     * Re-scans the active project directory and returns the updated FileTreeNode.
     * Useful after any operation that creates or deletes files outside the normal
     * save-file flow (D2C apply, template scaffolding, etc.).
     *
     * Returns null if no project is open (activeProjectRoot is null).
     *
     * Optional-chained by callers so Vitest / headless environments degrade
     * gracefully.
     */
    rescanWorkspace?: () => Promise<FileTreeNode | null>

    // ── Phase 0: Coverage Honesty ──────────────────────────────────────────────

    /**
     * Coverage observability API — returns the aggregate CoverageSummary for
     * the current project. Consumed by the StatusBar CoverageBadge via the
     * `useCoverageSummary` hook.
     *
     * The hook calls `getSummary()` on mount and on every `mcp-event` push
     * message with `eventType === "debt-scan-complete"` (existing channel —
     * no new IPC surface). Coverage is derived, not stored in Zustand.
     *
     * Until the real DebtReportService integration lands, returns a zero-state
     * (totalFiles === 0, governedSurfacePercent === 0).
     */
    coverage: {
        /**
         * Returns the current CoverageSummary from the main-process
         * DebtReportService. Channel: `flint:getCoverageSummary`.
         * No payload. Response is Zod-validated at the IPC boundary.
         */
        getSummary: () => Promise<CoverageSummary>
    }

    /**
     * RUNTIME.1 — axe-core Runtime Adapter surface.
     *
     * Exposes a single method for invoking the DOM-layer accessibility audit.
     * The primary LivePreview CSP is NEVER modified by the sandbox; a separate
     * BrowserWindow (Electron) or Playwright chromium page (web) hosts axe.
     *
     * The handler is always live regardless of the `runtime.axe.enabled`
     * feature flag — only the UI surfaces (StatusBar pill + GovernanceDashboard
     * accordion) are flag-gated on first ship.
     *
     * Contract:  .flint-context/contracts/RUNTIME.1-contract.md
     * Validator: shared/ipc-validators.ts runtimeRunAxePayloadSchema
     */
    runtime: {
        /**
         * Run the axe-core DOM audit against a preview HTML document.
         *
         * @param request.previewHtml — full HTML document to audit. Empty string
         *                              short-circuits to `{ status: 'no-preview' }`.
         * @param request.previewUrl  — optional URL-ish string for logging. Never
         *                              fetched — the sandbox has network blocked.
         * @param request.rules       — optional axe rule-ID filter. When absent,
         *                              runs all enabled rules from the bundled tag set.
         */
        runAxe: (request: {
            previewHtml: string
            previewUrl?: string
            rules?: string[]
        }) => Promise<{
            status:
                | 'idle'
                | 'running'
                | 'passed'
                | 'violations'
                | 'no-preview'
                | 'version-mismatch'
                | 'error'
            timestamp: string
            axeVersion: string
            nodeCount: number
            durationMs: number
            violations: Array<{
                ruleId: string
                elementId: string
                message: string
                severity: 'critical' | 'warning' | 'info' | 'advisory'
                wcag: string
                fixable: boolean
                explanation?: string
                recovery?: string
            }>
            error?: { code: string; message: string }
        }>
    }
}

// ── Phase Q: Asset metadata types ─────────────────────────────────────────────

/**
 * Asset metadata row from the assets_cache SQLite table.
 */
export interface AssetMeta {
    id: string
    name: string
    path: string
    tags: string
    format: string
    size: number
    isZombie?: boolean
}

/**
 * IPC surface for asset management (Phase Q).
 */
export interface AssetsAPI {
    getMetadata: () => Promise<AssetMeta[]>
    auditZombies: () => Promise<{ audited: number; zombies: number }>
}

// ── GOV.1 + GOV.2: Governance Provenance + Override Telemetry ────────────────

/**
 * Regulatory source authority that a governance rule traces back to.
 * Renderer-side mirror of the flint-mcp SourceAuthority type.
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Flint Design System'
    | 'Custom'

/**
 * Provenance metadata for a single governance rule.
 * Resolved from the static ruleProvenanceRegistry keyed by ruleId.
 * Renderer-side mirror of the flint-mcp RuleProvenance type.
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

// ── COUNSEL.3.2: Provenance Info ─────────────────────────────────────────────

/**
 * Provenance metadata for a single mutation on a node.
 * Returned by `governance.getProvenanceSummary(filePath)`.
 */
export interface ProvenanceInfo {
    /** Who or what introduced the mutation: 'human', agent name, 'auto-fix', or 'import'. */
    source: string
    /** Agent identifier when source is an AI agent, or undefined for human/auto-fix. */
    agentId?: string
    /** ISO timestamp of the mutation. */
    timestamp: string
}

// ── COUNSEL.3.3: Anomaly Alert ──────────────────────────────────────────────

/**
 * A single anomaly detected by the Flare statistical anomaly engine.
 * Returned by `governance.getAnomalies()`.
 */
export interface AnomalyAlert {
    /** Anomaly type, e.g. 'mutation_spike', 'override_spike', 'violation_spike'. */
    type: string
    /** Severity level: 'low', 'medium', 'high'. */
    severity: string
    /** Human-readable description of the anomaly. */
    message: string
    /** ISO timestamp of when the anomaly was detected. */
    detected_at: string
}

/**
 * IPC surface for governance telemetry operations (GOV.1 + GOV.2 + ERM-2).
 * Exposed as window.flintAPI.governance.
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
        /**
         * CHRON.1-repair M3: Optional free-text reason captured from the user
         * via OverrideReasonDialog for user-initiated violation overrides.
         * Persisted into the governance_events metadata JSON column alongside
         * { action, newValue } so the audit trail can render the reason later.
         * Undefined when the user waived the reason (Amber tier only).
         */
        reason?: string
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
     * The main process pushes 'flint:governance-override-recorded' after
     * each successful recordEvent call so StatusBar can re-fetch the count
     * without polling.
     *
     * Returns an unsubscribe function — pass it to useEffect cleanup.
     */
    onOverrideRecorded: (cb: () => void) => () => void

    /**
     * COUNSEL.1.4: Preview the proposed fix for a violation before applying.
     * Returns current and proposed token values for inline diff display.
     * Optional — not available in all environments.
     */
    previewFix?: (ruleId: string, filePath: string) => Promise<{
        current: string
        proposed: string
        tokenName: string
        isColor: boolean
    }>

    /**
     * COUNSEL.1.6: Batch-fix all auto-fixable a11y violations in a file.
     * Optional — not available in all environments.
     */
    batchFixA11y?: (filePath: string) => Promise<void>

    /**
     * COUNSEL.2.1: Defer a violation for later resolution.
     * Non-optional — always available when governance namespace is present.
     */
    deferViolation: (opts: {
        ruleId: string
        filePath: string
        nodeId?: string
        reason?: string
        duration?: '1 day' | '3 days' | '1 week' | '1 sprint' | 'Manually'
    }) => Promise<void>

    /**
     * COUNSEL.2.1: Returns all currently active (non-resolved) deferred violations.
     * Used by ExportModal on mount to pre-populate the Deferred badge state.
     * Optional — not available in all environments.
     */
    getDeferredViolations?: () => Promise<DeferredViolationRow[]>

    /**
     * Resolves a previously deferred violation by setting resolved_at.
     */
    resolveDeferredViolation?: (file: string, ruleId: string, nodeId?: string) => Promise<void>

    // ── ERM-2: Enterprise Rule Management ────────────────────────────────────

    /**
     * Returns the resolved governance configuration for the active project.
     * Merges flint.config.yaml extends chain into a single config object.
     * Returns null when no project is open.
     */
    getResolvedConfig: () => Promise<{
        config: Record<string, unknown>
        extendsChain: string[]
        activePresets: string[]
        projectRoot: string
    } | null>

    /**
     * Adds or removes a governance pack from flint.config.yaml's extends array.
     * Returns the updated extends chain so callers can optimistically update the store.
     */
    togglePack: (packId: string, enable: boolean) => Promise<{
        success: boolean
        extends?: string[]
        error?: string
    }>

    /**
     * Subscribes to 'flint:governance-config-changed' push events fired by
     * the main process whenever flint.config.yaml is written.
     *
     * Returns an unsubscribe function — pass it to useEffect cleanup.
     */
    onConfigChanged: (cb: () => void) => () => void

    // ── COUNSEL.3.2: Mutation Provenance ─────────────────────────────────────

    /**
     * Returns a map of nodeId → provenance info for all mutations on the given file.
     * Used by GovernanceDashboard to render "Introduced by [source]" chips on
     * violation cards. Returns an empty object when no provenance data is found.
     */
    getProvenanceSummary?: (filePath: string) => Promise<Record<string, ProvenanceInfo>>

    // ── COUNSEL.3.3: Anomaly Alerts ──────────────────────────────────────────

    /**
     * Returns recent anomalies (last 24 hours, unresolved) from the Flare
     * anomaly detection engine. Used by GovernanceDashboard to render the
     * anomaly alert banner at the top of the dashboard.
     */
    getAnomalies?: () => Promise<AnomalyAlert[]>

    // ── COUNSEL.3.1: Rewind to Clean State ──────────────────────────────────

    /**
     * Returns the most recent health-history entry with score >= 95.
     * Returns null when no clean state exists in history.
     */
    getLastCleanState?: () => Promise<{ timestamp: string; score: number } | null>

    // ── COUNSEL.4.1: Token Change Impact ────────────────────────────────────

    /**
     * Previews the impact of changing a design token across the project.
     * Returns the number of affected files and an impact classification.
     */
    previewTokenImpact?: (tokenName: string, newValue: string) => Promise<{
        affectedFiles: number
        estimatedImpact: 'low' | 'medium' | 'high'
    }>

    // ── COUNSEL.4.2: Compliance Trajectory ──────────────────────────────────

    /**
     * Returns the health score history for the compliance trajectory sparkline.
     * Each entry contains the date, score (0-100), and grade (A-F).
     */
    getHealthHistory?: () => Promise<Array<{ date: string; score: number; grade: string }>>

    /**
     * Records a health score entry to the history file.
     * Called after each audit to build the trajectory chart.
     */
    recordHealth?: (entry: { score: number; grade: string }) => Promise<void>

    // ── S8.3: MRS Pending Approval State ────────────────────────────────────

    /**
     * Returns pending mutations awaiting approval (Amber/Red risk tier).
     * Used by GovernanceDashboard to render the "Pending Approvals" section.
     */
    getPendingMutations?: () => Promise<PendingMutation[]>

    /**
     * Approves a pending mutation by setting its approved_at timestamp.
     * CHRON.1: Optional `reason` is written to the `justification` column
     * (trimmed, length-capped, control/format chars stripped, secrets redacted).
     */
    approveMutation?: (id: number, reason?: string) => Promise<void>

    /**
     * Rejects a pending mutation by deleting it from the ledger.
     */
    rejectMutation?: (id: number) => Promise<void>

    /**
     * CHRON.1: Records an orchestrator-path approval reason when no
     * `mutations_ledger` row exists to attach the justification to.
     * Writes a `governance_events` row with `event_type='override'` and
     * the sanitized reason stored in `metadata.reason`. Safe to ignore
     * the Promise — this is fire-and-forget from the renderer's view.
     */
    recordApprovalReason?: (args: { filePath: string; toolName: string; reason: string }) => Promise<void>

    /**
     * Runs deterministic auto-fix on all fixable violations in the given file.
     * Returns the number of fixes applied and the resulting status, or null
     * when no project is open or the file cannot be read.
     */
    applyFix?: (filePath: string) => Promise<{ fixesApplied: number; status: string } | null>

    /**
     * Returns recent entries from the governance audit log.
     * Used by GovernanceDashboard to render the activity timeline.
     * CHRON.1: Extended with `metadata` (JSON string that may include a
     * `reason` field) and `ruleId` for matching override events to
     * violation cards.
     */
    getAuditLog?: (opts?: { limit?: number }) => Promise<Array<{
        id: number | string
        timestamp: string
        action: string
        filePath: string
        description: string
        /** JSON string containing event metadata (may include a `reason` field). */
        metadata?: string | null
        /** Governance rule ID associated with the event, if any. */
        ruleId?: string | null
    }>>
}

// ── S8.3: Pending Mutation Type ──────────────────────────────────────────────

/**
 * A single pending mutation from the mutations_ledger awaiting approval.
 * Used by GovernanceDashboard "Pending Approvals" section (S8.3).
 */
export interface PendingMutation {
    id: number
    type: string
    filePath: string
    riskScore: number
    riskTier: string
    agentId?: string
    /** CHRON.1: Override/approval reason from the user, populated from the justification column. */
    reason?: string
}

// ── Delta Mode: Baseline Types (Gap 6) ───────────────────────────────────────

/**
 * A single row from the `violation_baselines` SQLite table.
 * Returned by `window.flintAPI.baseline.get(filePath)`.
 *
 * file_path      — Absolute path of the file the violation was found in.
 * node_id        — The data-flint-id of the violating JSX element.
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
 * Exposed as `window.flintAPI.baseline`.
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
 * The `.flint/policy.json` schema — renderer-side mirror.
 */
export interface FlintPolicy {
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

// ── BETA.3: Auto-Update ───────────────────────────────────────────────────────

/** Progress info pushed to the renderer during an update download. */
export interface UpdateDownloadProgress {
    /** Bytes downloaded per second. */
    bytesPerSecond: number
    /** Download percentage (0–100). */
    percent: number
    /** Total bytes in the update package. */
    total: number
    /** Bytes transferred so far. */
    transferred: number
}

/** Update metadata returned by checkForUpdates and pushed via onUpdateAvailable. */
export interface UpdateInfo {
    /** Version string of the available update (e.g. "0.2.0-beta.1"). */
    version: string
    /** Release notes as a markdown string, or null if not provided. */
    releaseNotes: string | null
    /** ISO 8601 release date string. */
    releaseDate: string
    /** True when the version string contains "beta". */
    isBeta: boolean
}

/**
 * Auto-update IPC surface.
 * Exposed as `window.flintAPI.autoUpdate`.
 */
export interface AutoUpdateAPI {
    /** Manually trigger an update check. Returns UpdateInfo or null if already up-to-date. */
    checkForUpdates: () => Promise<UpdateInfo | null>
    /** Begin downloading the available update. Progress arrives via onDownloadProgress. */
    downloadUpdate: () => Promise<void>
    /** Quit the app and install the downloaded update. Terminates the process. */
    quitAndInstall: () => void
    /** Returns the current update channel. */
    getChannel: () => Promise<'stable' | 'beta'>
    /** Sets the update channel. Takes effect on the next check. */
    setChannel: (channel: 'stable' | 'beta') => Promise<void>
    /** Subscribes to update-available push events. Returns unsubscribe fn. */
    onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void
    /** Subscribes to download-progress push events. Returns unsubscribe fn. */
    onDownloadProgress: (cb: (progress: UpdateDownloadProgress) => void) => () => void
    /** Subscribes to update-downloaded push events. Returns unsubscribe fn. */
    onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => () => void
    /** Subscribes to update error push events. Returns unsubscribe fn. */
    onError: (cb: (error: string) => void) => () => void
    /**
     * Alias for downloadUpdate() — used by StatusBar's "Download" button.
     * Begins downloading the available update.
     */
    download: () => Promise<void>
    /**
     * Alias for quitAndInstall() — used by StatusBar's "Install" button.
     * Quits the app and installs the downloaded update.
     */
    install: () => void
}

// ── Beta Distribution ────────────────────────────────────────────────────────

/** Feedback category for beta testers. */
export type BetaFeedbackCategory = 'bug' | 'feature' | 'usability' | 'other'

/** Perceived severity of a beta issue. */
export type BetaFeedbackSeverity = 'cosmetic' | 'annoying' | 'blocker'

/** Shape of a beta feedback submission from the renderer. */
export interface BetaFeedback {
    category: BetaFeedbackCategory
    description: string
    severity: BetaFeedbackSeverity
    /** Optional context (active file path, current panel, etc.) */
    context?: string
    /** Base64-encoded PNG screenshot, or null if user declined. */
    screenshot?: string | null
    /** System metadata auto-collected at submission time. */
    system?: {
        /** e.g. "MacIntel", "Win32", "Linux x86_64" */
        os: string
        /** From navigator.userAgent */
        osVersion: string
        screenWidth: number
        screenHeight: number
        devicePixelRatio: number
    }
}

/** Beta build metadata returned by getInfo(). */
export interface BetaInfo {
    buildId: string
    expiryDate: string | null
    daysRemaining: number | null
    isBeta: boolean
}

/** Update notification pushed from the main process. */
export interface BetaUpdateEvent {
    version: string
    downloadUrl: string
    message: string
}

/**
 * Beta distribution IPC surface.
 * Exposed as `window.flintAPI.beta`.
 */
export interface BetaAPI {
    /** Returns build ID, expiry date, and days remaining. */
    getInfo: () => Promise<BetaInfo>
    /** Saves feedback locally to .flint/beta-feedback.json. */
    submitFeedback: (feedback: BetaFeedback) => Promise<{ saved: boolean }>
    /** Copies the bundled demo project to a temp dir and returns the path. */
    loadDemoProject: (demoName?: string) => Promise<{ projectPath: string } | { error: string }>
    /**
     * Captures a screenshot of the focused window using BrowserWindow.capturePage().
     * Returns a base64-encoded PNG string, or null if capture failed.
     */
    captureScreenshot: () => Promise<string | null>
    /** Subscribes to update-available push events. Returns unsubscribe fn. */
    onUpdateAvailable: (callback: (event: BetaUpdateEvent) => void) => () => void
    /** Subscribes to remote expiry push events. Returns unsubscribe fn. */
    onExpiredRemote: (callback: (event: { message: string }) => void) => () => void
    /** Removes all beta push event listeners. */
    removeListeners: () => void
}

/**
 * IPC surface for reading the governance policy (Gap 3).
 * Exposed as `window.flintAPI.policy`.
 */
export interface PolicyAPI {
    /**
     * Returns the active governance policy from the main process.
     * Reads `.flint/policy.json` from the project root; returns
     * DEFAULT_POLICY if missing or malformed.
     */
    get: () => Promise<FlintPolicy>
}

declare global {
    interface Window {
        flintAPI: FlintAPI
    }
}

