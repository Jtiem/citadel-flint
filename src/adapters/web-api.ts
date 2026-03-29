/**
 * Web adapter for window.flintAPI.
 *
 * Implements the exact same interface as electron/preload.ts, but routes
 * all calls through HTTP (POST /api/ipc) and WebSocket (ws://host/ws)
 * instead of Electron IPC.
 *
 * The React app doesn't know the difference — it calls window.flintAPI.*
 * exactly as before.
 */

// ── Web-mode open-folder signal ──────────────────────────────────────────────
//
// In Electron, `openFolder()` shows a native OS directory picker.
// In web mode there is no native dialog, so `openFolder()`:
//   1. Dispatches a CustomEvent('flint:open-folder-request') on `window`
//   2. Returns a Promise that stays pending until `resolveWebOpenFolder` is called
//
// The React shell (LaunchScreen or any active modal) listens for this event,
// shows a text-input UI, then calls `resolveWebOpenFolder(path)` once the
// user confirms. This decouples the adapter from the React component tree.

export type OpenFolderResult = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: unknown[]
} | null

let _openFolderResolve: ((value: OpenFolderResult) => void) | null = null

/**
 * Resolves the pending `openFolder()` promise with the file tree for the
 * given path. Call this after the user submits a project path in the
 * web-mode path-input UI.
 *
 * If no `openFolder()` call is pending, this is a no-op.
 */
export async function resolveWebOpenFolder(folderPath: string): Promise<void> {
  if (!_openFolderResolve) return
  const resolve = _openFolderResolve
  _openFolderResolve = null
  try {
    const tree = (await invoke('project:openPath', folderPath)) as OpenFolderResult
    resolve(tree)
  } catch {
    resolve(null)
  }
}

/**
 * Cancels a pending `openFolder()` promise, resolving it with null (same
 * as the user dismissing the picker in Electron).
 */
export function cancelWebOpenFolder(): void {
  if (!_openFolderResolve) return
  const resolve = _openFolderResolve
  _openFolderResolve = null
  resolve(null)
}

/**
 * Returns true when an `openFolder()` deferred promise is in flight.
 * Components can use this to decide whether `resolveWebOpenFolder` should
 * be called instead of the standard `onOpenRecent` path.
 */
export function hasWebOpenFolderPending(): boolean {
  return _openFolderResolve !== null
}

// ── Transport layer ──────────────────────────────────────────────────────────

let ws: WebSocket | null = null
const channelListeners = new Map<string, Set<(...args: unknown[]) => void>>()
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

function ensureWS(): WebSocket {
  if (ws && ws.readyState === WebSocket.OPEN) return ws

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}/ws`)

  ws.onmessage = (event) => {
    try {
      const { channel, data } = JSON.parse(event.data)
      const listeners = channelListeners.get(channel)
      if (listeners) {
        listeners.forEach((cb) => {
          try { cb(data) } catch { /* listener errors don't crash transport */ }
        })
      }
    } catch { /* malformed message */ }
  }

  ws.onclose = () => {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
    wsReconnectTimer = setTimeout(() => ensureWS(), 2000)
  }

  return ws
}

function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
  ensureWS()
  if (!channelListeners.has(channel)) channelListeners.set(channel, new Set())
  channelListeners.get(channel)!.add(callback)
  return () => {
    channelListeners.get(channel)?.delete(callback)
  }
}

function unsubscribeAll(channel: string): void {
  channelListeners.delete(channel)
}

/**
 * Universal IPC-over-HTTP call. Mirrors ipcRenderer.invoke(channel, ...args).
 * The server has a single POST /api/ipc endpoint that dispatches by channel name.
 */
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const res = await fetch('/api/ipc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args }),
  })
  if (!res.ok) {
    throw new Error(`IPC call failed: ${channel} (${res.status})`)
  }
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.result
}

// ── FlintAPI implementation ──────────────────────────────────────────────────
// Mirrors electron/preload.ts exactly — same shape, same method signatures.

export function createWebFlintAPI() {
  // Connect WebSocket eagerly
  ensureWS()

  return {
    // ── Health check ────────────────────────────────────────────────────────
    ping: (): Promise<string> => invoke('ping') as Promise<string>,

    // ── Ingestion server status ─────────────────────────────────────────────
    getServerStatus: (): Promise<{ running: boolean; port: number }> =>
      invoke('server:get-status') as Promise<{ running: boolean; port: number }>,

    // ── Figma connection ────────────────────────────────────────────────────
    figma: {
      status: () => invoke('figma:status') as Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number }>,
      disconnect: () => invoke('figma:disconnect') as Promise<void>,
      onConnected: (callback: (event: { tokenCount: number; timestamp: number }) => void): (() => void) =>
        subscribe('flint:figma-connected', callback as (...args: unknown[]) => void),
      onError: (callback: (event: { statusCode: number; reason: string; timestamp: number }) => void): (() => void) =>
        subscribe('flint:figma-error', callback as (...args: unknown[]) => void),
      removeListeners: (): void => {
        unsubscribeAll('flint:figma-connected')
        unsubscribeAll('flint:figma-error')
      },
    },

    // ── Design token CRUD ───────────────────────────────────────────────────
    tokens: {
      create: (token: { token_path: string; token_type: string; token_value: string; description?: string }) =>
        invoke('tokens:create', token) as Promise<{ id: number }>,
      readAll: () => invoke('tokens:read-all') as Promise<unknown[]>,
      update: (tokenPath: string, updates: { token_type?: string; token_value?: string; description?: string | null }) =>
        invoke('tokens:update', tokenPath, updates) as Promise<{ changes: number }>,
      delete: (id: number) => invoke('tokens:delete', id) as Promise<{ changes: number }>,
      clearAll: () => invoke('tokens:clear-all') as Promise<{ changes: number }>,
      clearOverride: (flintId: string) => invoke('tokens:clear-override', flintId) as Promise<void>,
      upsertOverride: (flintId: string, propertyKey: string, propertyValue: string) =>
        invoke('tokens:upsert-override', flintId, propertyKey, propertyValue) as Promise<void>,
      readOverrides: () => invoke('tokens:read-overrides') as Promise<unknown[]>,
    },

    // ── Code transforms ─────────────────────────────────────────────────────
    transformCode: (code: string) =>
      invoke('code:transform', code) as Promise<{ js: string | null; error: string | null }>,
    transformVue: (code: string) =>
      invoke('code:transform-vue', code) as Promise<{ js: string | null; css: string; error: string | null }>,
    transformSvelte: (code: string) =>
      invoke('code:transform-svelte', code) as Promise<{ js: string | null; css: string; error: string | null }>,

    // ── Token live sync ─────────────────────────────────────────────────────
    onTokensUpdated: (callback: () => void): void => {
      subscribe('flint:tokens-updated', callback)
    },
    removeTokensUpdatedListener: (): void => {
      unsubscribeAll('flint:tokens-updated')
    },
    watchTokens: (callback: (tokens: unknown[]) => void): (() => void) => {
      const onUpdate = (): void => {
        void (invoke('tokens:read-all') as Promise<unknown[]>).then(callback)
      }
      const unsub = subscribe('flint:tokens-updated', onUpdate)
      // Deliver current state immediately
      void (invoke('tokens:read-all') as Promise<unknown[]>).then(callback)
      return unsub
    },

    // ── Multiplayer presence ────────────────────────────────────────────────
    syncPresence: (payload: { id: string; userId: string; nodeId?: string; x: number; y: number }) =>
      invoke('sync:update-presence', payload) as Promise<void>,
    readPresence: () => invoke('sync:read-presence') as Promise<unknown[]>,

    // ── File I/O ────────────────────────────────────────────────────────────
    saveFile: (filePath: string, content: string) =>
      invoke('ast:save-file', filePath, content) as Promise<void>,
    saveFileBatch: (batch: Record<string, string>) =>
      invoke('ast:save-batch', batch) as Promise<void>,

    // ── Folder / project operations ─────────────────────────────────────────
    openFolder: (): Promise<OpenFolderResult> => {
      // In web mode there is no native OS dialog. We dispatch a custom event
      // so the active path-input UI (LaunchScreen or a floating dialog) can
      // respond, then return a Promise that resolves once the user submits.
      // If a previous call is still pending we cancel it first.
      if (_openFolderResolve) {
        _openFolderResolve(null)
        _openFolderResolve = null
      }
      return new Promise<OpenFolderResult>((resolve) => {
        _openFolderResolve = resolve
        window.dispatchEvent(new CustomEvent('flint:open-folder-request'))
      })
    },
    selectFolder: () => invoke('dialog:selectFolder') as Promise<string | null>,

    registry: {
      getRecent: () => invoke('registry:getRecent') as Promise<{ id: string; name: string; path: string; last_opened: number }[]>,
      upsertProject: (payload: { name: string; path: string }) =>
        invoke('registry:upsertProject', payload) as Promise<void>,
      removeProject: (id: string) => invoke('registry:removeProject', id) as Promise<void>,
    },

    session: {
      getLastSession: () => invoke('project:get-last-session') as Promise<{ path: string; name: string; isScratchpad: boolean } | null>,
    },

    project: {
      initialize: (payload: { targetPath: string; templateId: string }) =>
        invoke('project:initialize', payload) as Promise<unknown>,
      openPath: (folderPath: string) => invoke('project:openPath', folderPath) as Promise<unknown>,
      resetToDemo: (targetPath: string) => invoke('project:reset-to-demo', targetPath) as Promise<unknown>,
      createScratchpad: () => invoke('project:create-scratchpad') as Promise<unknown>,
      reindex: () => invoke('project:reindex') as Promise<{ components: number; ragChunks: number }>,
    },

    // ── File read / git ─────────────────────────────────────────────────────
    readFile: (filePath: string) => invoke('file:read', filePath) as Promise<string>,
    gitShow: (filePath: string, commitHash: string) =>
      invoke('ast:git-show', filePath, commitHash) as Promise<string | null>,
    gitLog: (filePath: string) =>
      invoke('ast:git-log', filePath) as Promise<{ hash: string; message: string; timestamp: number }[]>,

    // ── Native menu (no-op in web — use CommandPalette instead) ─────────────
    menu: {
      onNewProject: (_callback: () => void): void => { /* no-op in web */ },
      onOpenProject: (_callback: () => void): void => { /* no-op in web */ },
      onCloseProject: (_callback: () => void): void => { /* no-op in web */ },
      onSaveProjectAs: (_callback: () => void): void => { /* no-op in web */ },
      onResetState: (_callback: () => void): void => { /* no-op in web */ },
      removeMenuListeners: (): void => { /* no-op in web */ },
    },

    // ── AI Orchestration ────────────────────────────────────────────────────
    applyBatch: (_mutations: unknown[]) => invoke('ai:apply-batch') as Promise<{ ok: boolean }>,

    ai: {
      chat: (messages: unknown[], context: unknown) =>
        invoke('ai:chat', messages, context) as Promise<void>,
      onChunk: (callback: (chunk: unknown) => void): void => {
        subscribe('ai:chunk', callback)
      },
      removeChunkListener: (): void => { unsubscribeAll('ai:chunk') },
      getConfig: () => invoke('ai:get-config') as Promise<{ hasKey: boolean; provider: string; model: string | null; baseURL: string | null }>,
      saveConfig: (config: { apiKey?: string; provider: string; model?: string; baseURL?: string }) =>
        invoke('ai:save-config', config) as Promise<void>,
      hydroPaste: (payloadStr: string) => invoke('flint:hydro-paste', payloadStr) as Promise<unknown>,
      onHydroPasteAuto: (callback: (payload: string) => void): (() => void) =>
        subscribe('flint:hydro-paste-auto', callback as (...args: unknown[]) => void),
      queryRAG: (query: string) => invoke('ai:query-rag', query) as Promise<unknown[]>,
      ingestRAG: (chunks: Array<{ content: string; source?: string; chunkType?: string }>) =>
        invoke('ai:ingest-rag', chunks) as Promise<{ ingested: number }>,
      clearRAG: () => invoke('ai:clear-rag') as Promise<void>,
      ragCount: () => invoke('ai:rag-count') as Promise<number>,
      seedRAG: () => invoke('ai:seed-rag') as Promise<{ ingested: number; sources: string[] }>,
    },

    // ── Preview engine ──────────────────────────────────────────────────────
    preview: {
      start: (projectRoot: string) => invoke('preview:start', projectRoot) as Promise<{ url: string } | { error: string }>,
      stop: () => invoke('preview:stop') as Promise<void>,
      getUrl: () => invoke('preview:url') as Promise<string | null>,
    },

    // ── Annotations ─────────────────────────────────────────────────────────
    annotations: {
      readAll: () => invoke('annotations:read-all') as Promise<unknown[]>,
      resolve: (id: string) => invoke('annotations:resolve', id) as Promise<void>,
      onChanged: (cb: () => void): void => { subscribe('flint:annotations-changed', cb) },
      removeChangedListener: (): void => { unsubscribeAll('flint:annotations-changed') },
    },

    // ── IDE file sync ───────────────────────────────────────────────────────
    onIDEFileSelected: (cb: (filePath: string) => void): void => {
      subscribe('flint:ide-file-selected', cb as (...args: unknown[]) => void)
    },
    removeIDEFileSelectedListener: (): void => {
      unsubscribeAll('flint:ide-file-selected')
    },

    // ── MCP integration ─────────────────────────────────────────────────────
    mcp: {
      callTool: (name: string, args: Record<string, unknown>) =>
        invoke('mcp:call-tool', name, args) as Promise<unknown>,
      readResource: (uri: string) => invoke('mcp:read-resource', uri) as Promise<unknown>,
      status: () => invoke('mcp:status') as Promise<{ connected: boolean; serverPid: number | null }>,
      reconnect: () => invoke('mcp:reconnect') as Promise<void>,
      onEvent: (callback: (events: unknown[]) => void): void => {
        subscribe('flint:mcp-event', callback as (...args: unknown[]) => void)
      },
      removeEventListener: (): void => { unsubscribeAll('flint:mcp-event') },
    },

    // ── Import summary ──────────────────────────────────────────────────────
    importSummary: {
      onSummary: (callback: (summary: unknown) => void): (() => void) =>
        subscribe('flint:import-summary', callback as (...args: unknown[]) => void),
      snapToToken: (payload: { nodeId: string; tokenPath: string; className: string; originalClass: string }) =>
        invoke('import:snap-to-token', payload) as Promise<{ ok: boolean; updatedSummary?: unknown }>,
      undoAllHeals: (preHealCode: string) =>
        invoke('import:undo-all-heals', preHealCode) as Promise<{ ok: boolean }>,
      removeListeners: (): void => { unsubscribeAll('flint:import-summary') },
    },

    // ── Violation baseline ──────────────────────────────────────────────────
    baseline: {
      set: (violations: Array<{ nodeId: string; ruleId: string; severity: string; filePath: string; value?: string }>) =>
        invoke('baseline:set', violations) as Promise<void>,
      get: (filePath: string) => invoke('baseline:get', filePath) as Promise<unknown[]>,
      clear: () => invoke('baseline:clear') as Promise<void>,
      isSet: () => invoke('baseline:is-set') as Promise<boolean>,
    },

    // ── Policy engine ───────────────────────────────────────────────────────
    policy: {
      get: () => invoke('policy:get') as Promise<unknown>,
    },

    // ── Governance telemetry ────────────────────────────────────────────────
    governance: {
      recordOverride: (payload: { ruleId: string; action: string; newValue: unknown; filePath: string }) =>
        invoke('governance:record-override', payload) as Promise<void>,
      getOverrideCount: () => invoke('governance:override-count') as Promise<number>,
      getComplianceSummary: (ruleIds: string[]) =>
        invoke('governance:compliance-summary', ruleIds) as Promise<unknown>,
      onOverrideRecorded: (cb: () => void): (() => void) =>
        subscribe('flint:governance-override-recorded', cb),
    },

    // ── Context sync ────────────────────────────────────────────────────────
    syncContext: (context: unknown) => invoke('context:sync', context) as Promise<void>,
    context: {
      getEnriched: () => invoke('context:get-enriched') as Promise<unknown>,
    },

    // ── Deferred violations ─────────────────────────────────────────────────
    deferViolation: (file: string, ruleId: string, nodeId?: string, reason?: string) =>
      invoke('governance:defer-violation', file, ruleId, nodeId, reason) as Promise<void>,
    getDeferredViolations: () => invoke('governance:get-deferred-violations') as Promise<unknown[]>,
    resolveDeferredViolation: (file: string, ruleId: string, nodeId?: string) =>
      invoke('governance:resolve-deferred-violation', file, ruleId, nodeId) as Promise<void>,

    // ── Beta (mostly no-ops in web) ─────────────────────────────────────────
    beta: {
      getInfo: () => Promise.resolve({ buildId: 'web', expiryDate: null, daysRemaining: null, isBeta: false }),
      submitFeedback: (feedback: unknown) => invoke('beta:submit-feedback', feedback) as Promise<{ saved: boolean }>,
      loadDemoProject: (demoName?: string) => invoke('beta:load-demo-project', { demoName }) as Promise<{ projectPath: string } | { error: string }>,
      captureScreenshot: () => Promise.resolve(null as string | null),
      onUpdateAvailable: (_callback: unknown): (() => void) => () => {},
      onExpiredRemote: (_callback: unknown): (() => void) => () => {},
      removeListeners: (): void => {},
    },

    // ── Auto-update (no-op in web) ──────────────────────────────────────────
    autoUpdate: {
      check: () => Promise.resolve(null),
      download: () => Promise.resolve(),
      install: () => Promise.resolve(),
      getChannel: () => Promise.resolve('stable' as const),
      setChannel: (_channel: string) => Promise.resolve(),
      onUpdateAvailable: (_cb: unknown): (() => void) => () => {},
      onDownloadProgress: (_cb: unknown): (() => void) => () => {},
      onUpdateDownloaded: (_cb: unknown): (() => void) => () => {},
      onError: (_cb: unknown): (() => void) => () => {},
    },

    // ── Setup wizard ────────────────────────────────────────────────────────
    setup: {
      detectIDEs: () => invoke('setup:detect-ides') as Promise<unknown>,
      checkFirstLaunch: () => invoke('setup:check-first-launch') as Promise<{ isFirstLaunch: boolean }>,
      completeFirstLaunch: () => invoke('setup:complete-first-launch') as Promise<void>,
      writeMCPConfig: (ideName: string, configPath: string, mcpServerPath: string) =>
        invoke('setup:write-mcp-config', ideName, configPath, mcpServerPath) as Promise<{ written: boolean }>,
      resetState: () => invoke('app:reset-state') as Promise<void>,
    },

    // ── Component cards ─────────────────────────────────────────────────────
    components: {
      list: () => invoke('components:list') as Promise<unknown[]>,
      savePositions: (positions: Record<string, { x: number; y: number }>) =>
        invoke('components:save-positions', positions) as Promise<void>,
      loadPositions: () => invoke('components:load-positions') as Promise<Record<string, { x: number; y: number }>>,
      setCategory: (payload: { componentId: string; category: string }) =>
        invoke('components:set-category', payload) as Promise<void>,
    },

    // ── Thumbnails (delegates to server-side Puppeteer service) ─────────────
    thumbnails: {
      generate: (payload: { filePath: string; componentName: string; width?: number; height?: number }) =>
        invoke('thumbnails:generate', payload) as Promise<{ componentName: string; thumbnailPath: string; generated: boolean; error: string | null }>,
      generateAll: () =>
        invoke('thumbnails:generate-all') as Promise<{ total: number; succeeded: number; failed: number; results: Array<{ componentName: string; thumbnailPath: string; generated: boolean; error: string | null }> }>,
      get: (componentName: string) =>
        invoke('thumbnails:get', componentName) as Promise<string | null>,
      invalidate: (componentName: string) =>
        invoke('thumbnails:invalidate', componentName) as Promise<void>,
    },

    // ── Governance autopilot ────────────────────────────────────────────────
    autopilot: {
      enable: (filePath: string) => invoke('autopilot:enable', filePath) as Promise<void>,
      disable: () => invoke('autopilot:disable') as Promise<void>,
      onResult: (callback: (result: unknown) => void): (() => void) =>
        subscribe('flint:autopilot-result', callback as (...args: unknown[]) => void),
    },

    // ── Component scope ─────────────────────────────────────────────────────
    scope: {
      getRegistryAndScope: () => invoke('scope:get-registry-and-scope') as Promise<unknown>,
      setScope: (update: { scope: string[] | null }) =>
        invoke('scope:set-scope', update) as Promise<{ ok: boolean; error?: string }>,
      getActiveLibrary: () => invoke('library:get-active') as Promise<{ library: string | null; availableLibraries: Array<{ library: string; displayName: string }> }>,
      setActiveLibrary: (update: { library: string | null }) =>
        invoke('library:set-active', update) as Promise<{ ok: boolean; library: string | null; seeded: number; error?: string }>,
    },

    // ── Enrichment ──────────────────────────────────────────────────────────
    enrichment: {
      getDrafts: () => invoke('enrichment:get-drafts') as Promise<unknown>,
      approve: (payload: { componentName: string; action: 'approve' | 'dismiss'; editedFields?: Record<string, unknown> }) =>
        invoke('enrichment:approve', payload) as Promise<{ ok: boolean; remainingDrafts: number; error?: string }>,
    },

    // ── Design-to-code ──────────────────────────────────────────────────────
    designToCode: {
      apply: (request: {
        pageName: string
        components: Array<{ name: string; code: string }>
        page: { name: string; code: string }
        themeFile?: { filename: string; code: string }
      }) => invoke('d2c:apply', request) as Promise<unknown>,
    },

    // ── Workspace rescan ────────────────────────────────────────────────────
    rescanWorkspace: () => invoke('workspace:rescan') as Promise<unknown>,
  }
}
