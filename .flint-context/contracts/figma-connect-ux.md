# Contract: Figma Connect UX Overhaul

**Date:** 2026-03-15
**Phase:** W.3 (Figma Connection Experience)
**Upstream dependency:** Phase W.2 (Figma Status Popover) -- ONLINE
**UX Plan:** `.flint-context/architect-reviews/FigmaConnect-UX-Plan.md`

---

## Architectural Summary

This feature replaces the static text block in LaunchScreen with a guided 3-step
wizard, enriches the StatusBar Figma popover with actions (copy buttons,
disconnect), and adds push-based connection feedback (toasts on success/error,
auto-detection of first sync).

**Process boundary crossings:**
- The ingestion server (main process) must push new IPC events to the renderer
  when connections succeed or fail.
- The renderer needs access to `port` and `secret` values that currently live
  only in `electron/ingestion-server.ts`.
- A new `figma:disconnect` IPC handler stops the ingestion server from the
  renderer.

**No new stores.** Connection state is transient (server up/down, wizard step)
and lives in component `useState`. The existing `FigmaStatus` type is extended
with `port` and `secret` fields so the renderer can render copy buttons without
hardcoding values.

**No new MCP tools.** Figma connection is a Glass-only UX concern.

**Key constraint (Passive Server):** The ingestion server is a passive HTTP
listener. It cannot initiate connections to Figma. "Sync Now" as "pull from
Figma" would require OAuth + Figma REST API calls, which is a future phase
(SYNC.1). For this phase, we do NOT implement "Sync Now". The StatusBar popover
will offer "Refresh Status" (re-polls `figma:status`), copy buttons, and
disconnect -- but no active pull.

---

## Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `src/types/flint-api.d.ts` | MODIFY -- extend `FigmaStatus`, extend `FigmaAPI` with new methods | flint-electron-ipc |
| `electron/ingestion-server.ts` | MODIFY -- expose `port`+`secret` in `getFigmaStatus()`, fire `flint:figma-connected` and `flint:figma-error` IPC push events | flint-electron-ipc |
| `electron/main.ts` | MODIFY -- register `figma:disconnect` IPC handler, pass `stopIngestionServer`/`startIngestionServer` | flint-electron-ipc |
| `electron/preload.ts` | MODIFY -- extend `figma` namespace with `onConnected()`, `onError()`, `disconnect()`, `removeListeners()` | flint-electron-ipc |
| `src/components/ui/FigmaSetupWizard.tsx` | NEW FILE -- 3-step guided wizard component | flint-design-engineer |
| `src/components/ui/LaunchScreen.tsx` | MODIFY -- replace inline text block with `<FigmaSetupWizard>` | flint-design-engineer |
| `src/components/editor/StatusBar.tsx` | MODIFY -- add copy buttons, disconnect button, "Refresh Status" to Figma popover | flint-design-engineer |
| `src/components/ui/__tests__/LaunchScreen.test.tsx` | MODIFY -- update Figma wizard test | flint-test-writer |
| `src/components/ui/__tests__/FigmaSetupWizard.test.tsx` | NEW FILE -- wizard-specific tests | flint-test-writer |
| `src/components/editor/__tests__/StatusBar.test.tsx` | MODIFY -- add tests for popover actions | flint-test-writer |

---

## Type Contracts (source of truth for Phase 2)

### Extended Types

```typescript
// ---- src/types/flint-api.d.ts ----

/**
 * Extended FigmaStatus -- adds port + secret so the renderer can render
 * copy-to-clipboard buttons without hardcoding values.
 *
 * REPLACES the existing FigmaStatus interface.
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
    /** The secret value the Figma plugin must send in x-flint-secret header. */
    secret: string
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
 *
 * REPLACES the existing FigmaAPI interface.
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
```

### New Component Props

```typescript
// ---- src/components/ui/FigmaSetupWizard.tsx ----

export interface FigmaSetupWizardProps {
    /**
     * Whether the wizard panel is open/visible.
     * Controlled by LaunchScreen's figmaSetupOpen state.
     */
    visible: boolean

    /**
     * Called when the wizard should close (after success, or user dismissal).
     */
    onClose: () => void
}

/**
 * Internal wizard step state. Not exported -- lives in component useState.
 *
 * 'checking'   -- Step 1: polling server status on mount
 * 'configure'  -- Step 2: showing endpoint + secret copy fields
 * 'waiting'    -- Step 3: waiting for first POST /ingest from Figma plugin
 * 'success'    -- Step 3 complete: first sync received, auto-close in 2s
 * 'error'      -- Server not running or connection failed
 */
type WizardStep = 'checking' | 'configure' | 'waiting' | 'success' | 'error'
```

---

## IPC Channels

### Existing (no changes needed)

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `figma:status` | renderer -> main | void | `FigmaStatus` |
| `server:get-status` | renderer -> main | void | `{ running: boolean; port: number }` |

### Modified

| Channel | Direction | Payload | Return | Change |
|---------|-----------|---------|--------|--------|
| `figma:status` | renderer -> main | void | `FigmaStatus` (extended) | Return type now includes `port` and `secret` fields |

### New

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `figma:disconnect` | renderer -> main | void | `void` |
| `flint:figma-connected` | main -> renderer (push) | `FigmaConnectedEvent` | N/A (broadcast) |
| `flint:figma-error` | main -> renderer (push) | `FigmaErrorEvent` | N/A (broadcast) |

---

## Store Contracts

**No new store slices.** All Figma connection state is transient and lives in
component-level `useState` within `FigmaSetupWizard` and `StatusBar`.

Rationale:
- Connection status is fetched on-demand via `figma:status` IPC (already exists).
- Push events (`flint:figma-connected`, `flint:figma-error`) are consumed
  directly by components that render toasts via `notificationStore.push()`.
- No other component in the app needs to observe Figma connection state
  reactively, so a Zustand store would be over-architecture.

### Existing Store Usage

| Store | Usage in This Feature |
|-------|----------------------|
| `notificationStore` | `push()` called to show success/error toasts when `flint:figma-connected` or `flint:figma-error` fires |

---

## Component Contracts

### FigmaSetupWizard (NEW)

| Attribute | Value |
|-----------|-------|
| File | `src/components/ui/FigmaSetupWizard.tsx` |
| Props | `FigmaSetupWizardProps` (see above) |
| Consumes Store | None |
| Calls IPC | `window.flintAPI.figma.status()` on mount to check server |
| Subscribes IPC | `window.flintAPI.figma.onConnected()` to detect first sync |
| Emits Store | `notificationStore.push()` on success |
| Internal State | `step: WizardStep`, `figmaStatus: FigmaStatus | null` |

**Behavior:**
1. On mount: call `figma.status()`. If `running === true`, auto-advance to
   'configure'. If not, show 'error' with troubleshooting hint.
2. Step 2 ('configure'): display endpoint (`http://127.0.0.1:{port}`) and
   secret from `FigmaStatus`. Each has a copy-to-clipboard button. User
   manually advances to Step 3 by clicking "I've configured the plugin".
3. Step 3 ('waiting'): subscribe to `figma.onConnected()`. Show a spinner
   with "Waiting for first sync from Figma...". On `figma-connected` event:
   transition to 'success', push toast, auto-close after 2 seconds.
4. Troubleshooting: collapsible section at the bottom (always accessible).

**Design decision: Why a separate component?**
The wizard has its own lifecycle (IPC subscriptions, auto-close timer, multi-step
state machine). Inlining this in LaunchScreen would bloat a component that should
stay simple. Extracting to `FigmaSetupWizard.tsx` keeps LaunchScreen focused on
its routing contract (the single source of truth for "no project open").

### LaunchScreen (MODIFIED)

| Attribute | Change |
|-----------|--------|
| Imports | Add `FigmaSetupWizard` |
| Template | Replace the `{figmaSetupOpen && <div>...4 steps...</div>}` block with `<FigmaSetupWizard visible={figmaSetupOpen} onClose={() => setFigmaSetupOpen(false)} />` |
| State | No change -- `figmaSetupOpen` already exists |

### StatusBar (MODIFIED)

| Attribute | Change |
|-----------|--------|
| Popover content | Add: endpoint copy row, secret copy row, separator, disconnect button, "Refresh Status" button |
| IPC subscriptions | Add: `figma.onConnected()` for success toast, `figma.onError()` for error toast (both in useEffect with cleanup) |
| State | Add: `copying: 'endpoint' | 'secret' | null` for brief "Copied!" feedback on copy buttons |

**Popover layout (extended):**
```
+-------------------------------+
|  Figma Connection          [X] |
|                                |
|  Server      Running [dot]     |
|  Last sync   2 minutes ago     |
|  Tokens      147               |
|                                |
|  ----------------------------  |
|  Endpoint  127.0.0.1:{port}[C] |
|  Secret    flint-dev...   [C] |
|                                |
|  ----------------------------  |
|  [Refresh Status] [Disconnect] |
|                                |
|  Need help? Setup guide        |
+-------------------------------+
```

**"Setup guide" link:** Dispatches `window.dispatchEvent(new CustomEvent('flint:open-figma-wizard'))`.
LaunchScreen or App.tsx can listen for this to re-open the wizard. Since
LaunchScreen only mounts when no project is open, this link is most useful when
a project IS open. For v1, the link simply opens a popover tooltip explaining
"Close your project to access the setup wizard from the Launch Screen."

**"Disconnect" behavior:** Calls `window.flintAPI.figma.disconnect()`, then
re-fetches `figma.status()` to update the dot. Pushes a toast:
"Figma server stopped. Restart Flint to reconnect." No undo path in v1 -- the
server restarts on next app launch.

**"Refresh Status" behavior:** Calls `figma.status()` and updates local state.
No IPC side effects. This replaces the UX plan's "Sync Now" -- which would
require OAuth and active Figma API calls that are out of scope.

---

## IPC Implementation Details

### electron/ingestion-server.ts

**`getFigmaStatus()` -- return type extended:**
```typescript
export function getFigmaStatus(): FigmaStatus {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM design_tokens').get() as { count: number }
    return {
        running: server !== null && server.listening,
        lastWebhookAt,
        tokenCount: countRow?.count ?? 0,
        port: activePort,
        secret: FLINT_SECRET,
    }
}
```

**`flint:figma-connected` push -- fire after successful POST /ingest:**

In the `handleRequest` function, after `batchUpsertTokens(tokens)` succeeds and
`lastWebhookAt` is updated, add:

```typescript
// Fire connection event with token count
windows[0].webContents.send('flint:figma-connected', {
    tokenCount: tokens.length,
    timestamp: Date.now(),
})
```

**`flint:figma-error` push -- fire on 401 (bad secret) and 400 (bad payload):**

In the `handleRequest` function, after sending 401 or 400 responses, add:

```typescript
const windows = BrowserWindow.getAllWindows()
if (windows.length > 0) {
    windows[0].webContents.send('flint:figma-error', {
        statusCode: 401,   // or 400
        reason: '...',     // same message sent in the HTTP response
        timestamp: Date.now(),
    })
}
```

### electron/main.ts

**New handler:**
```typescript
ipcMain.handle('figma:disconnect', () => {
    stopIngestionServer()
})
```

### electron/preload.ts

**Extended `figma` namespace:**
```typescript
figma: {
    status: (): Promise<FigmaStatus> =>
        ipcRenderer.invoke('figma:status'),

    disconnect: (): Promise<void> =>
        ipcRenderer.invoke('figma:disconnect'),

    onConnected: (callback: (event: FigmaConnectedEvent) => void): (() => void) => {
        const listener = (_event: Electron.IpcRendererEvent, data: FigmaConnectedEvent) => callback(data)
        ipcRenderer.on('flint:figma-connected', listener)
        return () => {
            ipcRenderer.removeListener('flint:figma-connected', listener)
        }
    },

    onError: (callback: (event: FigmaErrorEvent) => void): (() => void) => {
        const listener = (_event: Electron.IpcRendererEvent, data: FigmaErrorEvent) => callback(data)
        ipcRenderer.on('flint:figma-error', listener)
        return () => {
            ipcRenderer.removeListener('flint:figma-error', listener)
        }
    },

    removeListeners: (): void => {
        ipcRenderer.removeAllListeners('flint:figma-connected')
        ipcRenderer.removeAllListeners('flint:figma-error')
    },
},
```

---

## Commandment Checklist

- [x] **C4 Local-First Only** -- No external URLs. The ingestion server is loopback-only. The wizard does not link to external Figma docs (the existing GitHub link in LaunchScreen is removed in favor of the in-app troubleshooting section). Copy buttons produce `http://127.0.0.1:{port}` which is a local address, not an external URL. No network calls are made by Glass.
- [x] **C9 Process Boundary** -- All new IPC channels go through `contextBridge` in `preload.ts`. No `fs`, `sqlite`, or Node.js imports in `src/`. The renderer accesses port and secret values via `figma.status()` IPC, never by reading process env or server state directly.
- [x] **C12 Atomic Queuing** -- This feature does not write files. The ingestion server's token upserts already use `batchUpsertTokens` (SQLite transaction). No `FileTransactionManager` involvement needed.
- [x] **C14 Bypass Prohibition** -- `stopIngestionServer()` is called through IPC, not by importing `ingestion-server.ts` in the renderer. The renderer calls `window.flintAPI.figma.disconnect()` which routes through preload -> main -> `stopIngestionServer()`.

**Not applicable:**
- C1 (Code is Truth) -- no AST mutations
- C2 (No Hallucinated Styling) -- no visual edits to user code
- C3 (Composite IDs) -- no dynamic lists with flint IDs
- C5 (Accessibility Compiler Error) -- no export gate changes
- C6 (Gatekeeper Rule) -- no export gate changes
- C7 (ID Preservation) -- no AST structural ops
- C8 (Audit-First) -- no AI routing
- C9 (CIEDE2000) -- no color drift detection
- C10 (Targeted Recovery) -- no undo operations
- C11 (Git Transplants) -- no git operations
- C13 (Deterministic Surgery) -- no source code modification
- C15 (AST Tools Only) -- no AI orchestration
- C16 (In-Memory Validation) -- no AI output

---

## Implementation Order

### Group 0: Types (sequential, first)

No separate step needed -- the type changes in `flint-api.d.ts` are part of
the IPC group (Group A) since the same agent owns both.

### Group A (parallel): IPC + Types

| Agent | Files | What |
|-------|-------|------|
| `flint-electron-ipc` | `src/types/flint-api.d.ts`, `electron/ingestion-server.ts`, `electron/main.ts`, `electron/preload.ts` | Extend `FigmaStatus`/`FigmaAPI` types, add `port`+`secret` to `getFigmaStatus()`, add `flint:figma-connected` and `flint:figma-error` push events, add `figma:disconnect` handler, extend preload `figma` namespace |

### Group B (parallel, after A): UI + Tests

| Agent | Files | What |
|-------|-------|------|
| `flint-design-engineer` | `src/components/ui/FigmaSetupWizard.tsx` (NEW), `src/components/ui/LaunchScreen.tsx`, `src/components/editor/StatusBar.tsx` | Build wizard component, replace LaunchScreen text block, add StatusBar popover actions |
| `flint-test-writer` | `src/components/ui/__tests__/FigmaSetupWizard.test.tsx` (NEW), `src/components/ui/__tests__/LaunchScreen.test.tsx`, `src/components/editor/__tests__/StatusBar.test.tsx` | Wizard tests, update existing tests |

### Group C (after B): Review

| Agent | Files | What |
|-------|-------|------|
| `flint-code-reviewer` | All modified files | IPC symmetry check, process boundary audit, commandment compliance |

---

## Test Requirements

### FigmaSetupWizard.test.tsx (NEW -- 8 tests minimum)

1. **Renders 3 step indicators** -- wizard shows Step 1, Step 2, Step 3 labels
2. **Step 1 auto-completes when server is running** -- mock `figma.status()` returning `{ running: true, ... }`, verify wizard advances to 'configure' step
3. **Step 1 shows error when server is not running** -- mock `figma.status()` returning `{ running: false, ... }`, verify error state rendered
4. **Step 2 shows endpoint with correct port** -- mock status with `port: 4546`, verify rendered text includes `127.0.0.1:4546`
5. **Step 2 shows secret** -- verify secret value from status is rendered (masked or truncated)
6. **Copy endpoint button copies to clipboard** -- mock `navigator.clipboard.writeText`, click copy, verify called with `http://127.0.0.1:{port}`
7. **Copy secret button copies to clipboard** -- mock `navigator.clipboard.writeText`, click copy, verify called with secret value
8. **Step 3 transitions to success on figma-connected event** -- simulate `onConnected` callback firing, verify success state

### LaunchScreen.test.tsx (MODIFIED -- update test 9)

Test 9 currently checks for "Flint Figma plugin setup" text. After the change,
the wizard is a separate component. Update the test to verify that clicking
"Connect Figma" renders the `FigmaSetupWizard` component (check for a
wizard-specific data-testid or heading text).

### StatusBar.test.tsx (MODIFIED -- add 3 tests)

10. **Copy endpoint button copies correct value** -- open popover, click copy on endpoint row, verify clipboard call
11. **Copy secret button copies correct value** -- open popover, click copy on secret row, verify clipboard call
12. **Disconnect button calls figma.disconnect()** -- open popover, click disconnect, verify IPC called

**No e2e tests** for actual Figma plugin communication (requires running Figma
desktop app with the plugin installed).

---

## Risks

### 1. Secret exposure in renderer (LOW)

The `secret` field is now exposed to the renderer via IPC. This is acceptable
because:
- The secret is only used for loopback authentication (127.0.0.1).
- It is already visible in the terminal output when Flint starts.
- The renderer displays it in a copy field (the whole point of this feature).
- An attacker with renderer access already has full `flintAPI` access.

Mitigation: none needed for v1. Future: consider time-limited tokens.

### 2. Port fallback confusion (LOW)

If port 4545 is busy, the server falls back to 4546+. The wizard now reads the
actual port from `FigmaStatus.port`, so the copy button will always show the
correct value. However, the Figma plugin may have cached `4545` from a previous
session.

Mitigation: the troubleshooting section explicitly mentions port fallback
behavior and instructs the user to re-copy the endpoint.

### 3. "Disconnect" has no "Reconnect" path (MEDIUM)

Calling `figma:disconnect` stops the server. There is no `figma:reconnect` IPC
to restart it without restarting the entire app. This is by design for v1 -- the
server auto-starts on app launch.

Mitigation: the disconnect toast says "Restart Flint to reconnect." A future
`figma:reconnect` handler can call `startIngestionServer()` if needed.

### 4. Race between `flint:figma-connected` and wizard mount (LOW)

If the user opens the wizard AFTER the Figma plugin has already sent a
successful POST, the `onConnected` listener will miss the event. The wizard
handles this by checking `FigmaStatus.lastWebhookAt !== null` during the initial
status fetch -- if tokens already exist, it skips straight to 'success'.

### 5. Stale test assertions (LOW)

Existing test 9 in `LaunchScreen.test.tsx` and tests 2-3 in `StatusBar.test.tsx`
assert on the old Figma popover structure. These must be updated in Group B.

Mitigation: `flint-test-writer` receives explicit instructions to update these
assertions.

### 6. StatusBar test mocks may need `port` and `secret` fields (LOW)

The existing StatusBar test mocks `figma.status()` implicitly (via the global
mock in the test setup). After extending `FigmaStatus`, the mock must return the
new fields or tests will fail.

Mitigation: `flint-test-writer` updates the mock factory to include `port: 4545`
and `secret: 'test-secret'` defaults.

---

## Files Summary

### Modified
- `/Users/tiemann/Lunar-Elevator-Flint/src/types/flint-api.d.ts`
- `/Users/tiemann/Lunar-Elevator-Flint/electron/ingestion-server.ts`
- `/Users/tiemann/Lunar-Elevator-Flint/electron/main.ts`
- `/Users/tiemann/Lunar-Elevator-Flint/electron/preload.ts`
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/ui/LaunchScreen.tsx`
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/editor/StatusBar.tsx`
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/ui/__tests__/LaunchScreen.test.tsx`
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/editor/__tests__/StatusBar.test.tsx`

### New
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/ui/FigmaSetupWizard.tsx`
- `/Users/tiemann/Lunar-Elevator-Flint/src/components/ui/__tests__/FigmaSetupWizard.test.tsx`
