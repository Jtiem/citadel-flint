# Contract: OAUTH.1 -- Figma OAuth Flow for Glass

**Phase:** OAUTH.1
**Status:** CONTRACT
**Author:** flint-architect
**Date:** 2026-03-26

---

## 1. Problem Statement

Every Flint Glass user must manually generate a Figma Personal Access Token (PAT),
copy it, and paste it into Flint before token sync works. This is a multi-step
workflow that requires navigating Figma's developer settings. Designers will not
do this. The connection step must be: click "Connect Figma" -> browser opens ->
authorize -> done.

## 2. Solution Overview

Implement Figma's OAuth 2.0 Authorization Code Grant with PKCE, running entirely
in the Electron main process. A temporary loopback HTTP server receives the
authorization callback. Tokens are encrypted via `safeStorage` (SEC.4) and stored
in the existing `figma_connections` SQLite table. The existing PAT flow is preserved
as a fallback for CI/headless environments.

### Key Architectural Facts (from source analysis)

The existing infrastructure is remarkably well-prepared for OAuth:

- `figma_connections` table already has `refresh_token_encrypted TEXT` and
  `token_expiry TEXT` columns (syncSchema.ts line 23-24) -- currently unused
- `FigmaConnection` type already has `refreshTokenEncrypted` and `tokenExpiry`
  fields (types.ts line 20-21) -- currently always null
- `ConnectionService` already injects `TokenCrypto` for safeStorage encryption
- The ingestion server establishes the loopback-only callback server pattern
- `safeStorage` is already imported in main.ts (line 1) and used for API keys

What is missing: the OAuth flow orchestration, token refresh logic, IPC channels
for initiating/monitoring the flow, and the Glass UI trigger.

---

## 3. OAuth Flow Sequence

```
  Glass Renderer              Electron Main Process              System Browser           Figma OAuth Server
  ──────────────              ─────────────────────              ──────────────           ──────────────────
       │                              │                               │                         │
       │  figma:oauth:start           │                               │                         │
       │─────────────────────────────>│                               │                         │
       │                              │                               │                         │
       │                              │ 1. Generate PKCE              │                         │
       │                              │    code_verifier (128 chars)  │                         │
       │                              │    code_challenge = S256(cv)  │                         │
       │                              │    state = randomUUID()       │                         │
       │                              │                               │                         │
       │                              │ 2. Start loopback HTTP        │                         │
       │                              │    server on ephemeral port   │                         │
       │                              │    (127.0.0.1:0)              │                         │
       │                              │                               │                         │
       │                              │ 3. shell.openExternal()       │                         │
       │                              │────────────────────────────>  │                         │
       │                              │                               │                         │
       │  { status: 'pending' }       │                               │ 4. User authorizes      │
       │<─────────────────────────────│                               │─────────────────────────>
       │                              │                               │                         │
       │                              │                               │  5. Redirect to         │
       │                              │  6. Receive callback          │<─── localhost:PORT/      │
       │                              │<──────────────────────────────│     oauth/callback       │
       │                              │     ?code=AUTH_CODE           │     ?code=...&state=...  │
       │                              │     &state=STATE              │                         │
       │                              │                               │                         │
       │                              │ 7. Verify state matches       │                         │
       │                              │                               │                         │
       │                              │ 8. POST /api/oauth/token      │                         │
       │                              │─────────────────────────────────────────────────────────>
       │                              │     client_id, code,          │                         │
       │                              │     code_verifier,            │                         │
       │                              │     redirect_uri              │                         │
       │                              │                               │                         │
       │                              │ 9. Receive tokens             │                         │
       │                              │<─────────────────────────────────────────────────────────
       │                              │     access_token,             │                         │
       │                              │     refresh_token,            │                         │
       │                              │     expires_in                │                         │
       │                              │                               │                         │
       │                              │ 10. Encrypt via safeStorage   │                         │
       │                              │     Store in figma_connections│                         │
       │                              │     Close loopback server     │                         │
       │                              │                               │                         │
       │                              │ 11. Fetch file name via       │                         │
       │                              │     GET /v1/files/{fileKey}   │                         │
       │                              │─────────────────────────────────────────────────────────>
       │                              │<─────────────────────────────────────────────────────────
       │                              │                               │                         │
       │  flint:figma-oauth-complete  │                               │                         │
       │<─────────────────────────────│                               │                         │
       │  { status, fileName }        │                               │                         │
       │                              │                               │                         │
```

### Token Refresh Flow (transparent, before every Figma API call)

```
  Any sync operation          FigmaOAuthService              Figma OAuth Server
  ────────────────            ─────────────────              ──────────────────
       │                              │                              │
       │  getValidAccessToken()       │                              │
       │─────────────────────────────>│                              │
       │                              │                              │
       │                              │ Check token_expiry           │
       │                              │ If not expired:              │
       │  access_token                │   decrypt and return         │
       │<─────────────────────────────│                              │
       │                              │                              │
       │                              │ If expired:                  │
       │                              │   POST /api/oauth/refresh    │
       │                              │─────────────────────────────>│
       │                              │                              │
       │                              │   new access_token,          │
       │                              │   new refresh_token,         │
       │                              │   new expires_in             │
       │                              │<─────────────────────────────│
       │                              │                              │
       │                              │   Re-encrypt, update DB      │
       │  new access_token            │                              │
       │<─────────────────────────────│                              │
       │                              │                              │
       │                              │ If refresh fails (401):      │
       │  { expired: true }           │   Set connection status      │
       │<─────────────────────────────│   to 'expired'               │
       │                              │                              │
```

---

## 4. Impact Map

| File | Change Type | Owner Agent | Description |
|------|-------------|-------------|-------------|
| `electron/figmaOAuth.ts` | CREATE | flint-electron-ipc | OAuth service: PKCE generation, loopback callback server, token exchange, token refresh, encrypted storage |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Register 3 IPC handlers: `figma:oauth:start`, `figma:oauth:status`, `figma:oauth:disconnect` |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Extend `figma` namespace with `oauthStart`, `oauthStatus`, `oauthDisconnect`, `onOAuthComplete` |
| `src/types/flint-api.d.ts` | MODIFY | flint-state-architect | `FigmaOAuthStatus` type, extended `FigmaAPI` interface |
| `src/components/editor/StatusBar.tsx` | MODIFY | flint-design-engineer | Replace popover action buttons: primary "Connect with Figma" OAuth button, secondary PAT link |
| `src/components/ui/FigmaSetupWizard.tsx` | MODIFY | flint-design-engineer | Add OAuth as primary Step 1 option with PAT as fallback toggle |
| `flint-mcp/src/core/sync/connectionService.ts` | MODIFY | flint-electron-ipc | Add `createOAuthConnection()` (stores refresh token + expiry), `updateTokens()` for refresh |
| `flint-mcp/src/core/sync/types.ts` | MODIFY | flint-state-architect | Add `authMethod` field to `FigmaConnection`, add `'expired'` to `ConnectionStatus` |
| `flint-mcp/src/core/sync/syncSchema.ts` | MODIFY | flint-electron-ipc | Add `auth_method` column (`'pat' \| 'oauth'`) with default `'pat'` for backward compat |
| `flint-mcp/src/core/sync/figmaApiService.ts` | MODIFY | flint-electron-ipc | Accept `Authorization: Bearer` header (OAuth) alongside `X-Figma-Token` (PAT) |
| `electron/__tests__/figmaOAuth.test.ts` | CREATE | flint-test-writer | Unit tests for PKCE, callback server, token exchange, refresh, error handling |
| `src/components/editor/__tests__/StatusBar.test.tsx` | MODIFY | flint-test-writer | Tests for OAuth button rendering, status display |

---

## 5. Type Contracts

### 5.1 Figma OAuth Configuration (electron-side only, never crosses IPC)

```typescript
// electron/figmaOAuth.ts

/** Figma OAuth app credentials. Stored in the Electron binary, never in renderer. */
interface FigmaOAuthConfig {
  clientId: string
  clientSecret: string
  /** Scopes requested from Figma. */
  scopes: string[]
}

/** Default scopes for Figma token sync. */
const FIGMA_OAUTH_SCOPES = [
  'files:read',
  'file_variables:read',
  'file_variables:write',
] as const

/** PKCE pair generated fresh for each authorization attempt. */
interface PKCEPair {
  codeVerifier: string   // 128-char random Base64URL string
  codeChallenge: string  // SHA-256 hash of codeVerifier, Base64URL encoded
}

/** Token response from Figma's POST /api/oauth/token. */
interface FigmaTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number      // seconds until access_token expires
  user_id: number
}

/** Internal state tracking for an in-flight OAuth attempt. */
interface OAuthFlowState {
  state: string           // CSRF protection nonce (randomUUID)
  codeVerifier: string    // PKCE code_verifier
  redirectUri: string     // http://127.0.0.1:{port}/oauth/callback
  projectRoot: string     // which project this connection is for
  fileKey: string         // Figma file key to connect
  startedAt: number       // Date.now() -- for timeout detection
}
```

### 5.2 IPC Payload and Return Types (cross-boundary)

```typescript
// These types are mirrored in src/types/flint-api.d.ts for the renderer

/** Payload sent from renderer to main via figma:oauth:start. */
interface FigmaOAuthStartPayload {
  /** Figma file key (extracted from URL by the user or auto-detected). */
  fileKey: string
}

/** Status returned by figma:oauth:status. */
type FigmaOAuthConnectionStatus =
  | { connected: false; authMethod: null }
  | {
      connected: true
      authMethod: 'oauth' | 'pat'
      figmaFileName: string
      figmaFileKey: string
      /** True when the OAuth access token has expired and refresh is needed. */
      tokenExpired: boolean
      connectedAt: string
      lastSyncAt: string | null
    }

/** Push event sent from main to renderer on OAuth flow completion. */
interface FigmaOAuthCompleteEvent {
  success: boolean
  figmaFileName?: string
  figmaFileKey?: string
  error?: string
}
```

### 5.3 Extended FigmaConnection Type

```typescript
// flint-mcp/src/core/sync/types.ts -- MODIFIED

export type ConnectionStatus = 'active' | 'disconnected' | 'error' | 'expired'

export type AuthMethod = 'pat' | 'oauth'

export interface FigmaConnection {
  id: string
  projectRoot: string
  figmaFileKey: string
  figmaFileName: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string | null
  tokenExpiry: string | null
  connectedAt: string
  lastSyncAt: string | null
  status: ConnectionStatus
  authMethod: AuthMethod   // NEW -- defaults to 'pat' for existing rows
}
```

### 5.4 Extended ConnectionService Methods

```typescript
// flint-mcp/src/core/sync/connectionService.ts -- NEW METHODS

/**
 * Create a connection established via OAuth.
 * Stores both access and refresh tokens encrypted, plus expiry timestamp.
 */
createOAuthConnection(
  projectRoot: string,
  fileKey: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,  // seconds from now
  fileName?: string,
): FigmaConnection

/**
 * Update OAuth tokens after a successful refresh.
 * Called by FigmaOAuthService when a token refresh succeeds.
 */
updateTokens(
  projectRoot: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): boolean

/**
 * Check if the active connection's OAuth token has expired.
 * Returns false for PAT connections (they don't expire this way).
 */
isTokenExpired(projectRoot: string): boolean
```

### 5.5 Extended FigmaAPI (renderer-side)

```typescript
// src/types/flint-api.d.ts -- additions to FigmaAPI interface

export interface FigmaAPI {
  // ... existing methods ...

  /**
   * Initiates the OAuth flow. Opens the system browser for Figma authorization.
   * Returns immediately with { status: 'pending' }.
   * Listen for completion via `onOAuthComplete`.
   */
  oauthStart: (payload: { fileKey: string }) => Promise<{ status: 'pending' | 'error'; error?: string }>

  /**
   * Returns the current Figma connection status (OAuth or PAT).
   * Does NOT return tokens -- only connection metadata.
   */
  oauthStatus: () => Promise<FigmaOAuthConnectionStatus>

  /**
   * Disconnects the Figma OAuth connection for the active project.
   * Revokes the token with Figma if possible, then clears local storage.
   */
  oauthDisconnect: () => Promise<void>

  /**
   * Subscribe to OAuth flow completion events.
   * Fired once per flow (success or failure).
   * Returns unsubscribe function.
   */
  onOAuthComplete: (callback: (event: FigmaOAuthCompleteEvent) => void) => (() => void)
}
```

---

## 6. IPC Channel Definitions

| Channel | Direction | Payload Type | Return Type | Handler Location |
|---------|-----------|-------------|-------------|-----------------|
| `figma:oauth:start` | renderer -> main | `FigmaOAuthStartPayload` | `{ status: 'pending' \| 'error'; error?: string }` | `electron/main.ts` -> `FigmaOAuthService.startFlow()` |
| `figma:oauth:status` | renderer -> main | (none) | `FigmaOAuthConnectionStatus` | `electron/main.ts` -> reads ConnectionService |
| `figma:oauth:disconnect` | renderer -> main | (none) | `void` | `electron/main.ts` -> `FigmaOAuthService.disconnect()` |
| `ipcChannel('figma-oauth-complete')` | main -> renderer | `FigmaOAuthCompleteEvent` | (push, no return) | `electron/figmaOAuth.ts` emits on flow completion |

---

## 7. Store Contracts

No new Zustand stores are needed. The OAuth flow is entirely IPC-driven with
component-local state in StatusBar and FigmaSetupWizard.

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| (none) | -- | -- | -- |

Rationale: OAuth connection status is ephemeral UI state (is the flow in progress?
did it succeed?) that belongs in component `useState`, not global state. The
persistent connection data lives in SQLite via ConnectionService, queried on demand
through IPC. This follows the established pattern in StatusBar which already uses
local state for `figmaStatus`.

---

## 8. Component Contracts

### 8.1 StatusBar Figma Popover (MODIFIED)

The existing Figma popover in StatusBar gains a "Connect with Figma" button as
the primary call-to-action when no active connection exists.

```
Current popover layout:
  Header: "Figma Connection"
  Status rows: Server | Last sync | Tokens
  Endpoint copy row
  Actions: [Refresh Status] [Disconnect]
  Help link

New popover layout (when NOT connected via OAuth):
  Header: "Figma Connection"
  Status rows: Server | Last sync | Tokens
  ─────────────────────────────────────────
  Primary CTA: [  Connect with Figma  ]     <- indigo button, opens OAuth
  File key input: [______________________]  <- text input for Figma file key
  Secondary: "Or use a Personal Access Token" <- text link, expands PAT input
  ─────────────────────────────────────────
  Endpoint copy row (for plugin method)

New popover layout (when connected via OAuth):
  Header: "Figma Connection"
  Status rows: Server | Connected to: {fileName} | Last sync | Tokens
  Auth: OAuth (active)                          <- green badge
  ─────────────────────────────────────────
  Actions: [Refresh Status] [Disconnect]
```

Props and dependencies:
- Uses `window.flintAPI.figma.oauthStart()` for OAuth initiation
- Uses `window.flintAPI.figma.oauthStatus()` for connection status polling
- Uses `window.flintAPI.figma.onOAuthComplete()` for flow completion notification
- File key input: user pastes a Figma URL, component extracts the file key
  using regex: `/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/`

### 8.2 FigmaSetupWizard (MODIFIED)

The existing wizard (used on LaunchScreen) gets OAuth as the primary path:

```
Step 1 (NEW): "Connect your Figma account"
  [  Connect with Figma  ]     <- OAuth button
  File key input: [___________]
  "Or connect via Figma plugin" <- toggle to show existing Step 2

Step 2 (existing): "Configure the Figma plugin"
  Endpoint copy, secret (server-side)

Step 3 (existing): "Waiting for first sync"
  Listens for onConnected OR onOAuthComplete
```

---

## 9. FigmaOAuthService API (electron/figmaOAuth.ts)

```typescript
/**
 * OAUTH.1 -- Figma OAuth Service.
 *
 * Orchestrates the OAuth 2.0 Authorization Code Grant with PKCE for
 * desktop Figma authorization. Runs entirely in the Electron main process.
 *
 * Security model:
 *   - client_secret stays in the main process binary, never in renderer
 *   - PKCE prevents authorization code interception
 *   - state parameter prevents CSRF
 *   - Loopback callback server on 127.0.0.1 only (not 0.0.0.0)
 *   - Tokens encrypted via safeStorage before SQLite storage
 *   - Tokens never cross the IPC boundary
 *
 * Lifecycle:
 *   1. startFlow(projectRoot, fileKey) -- opens browser, starts callback server
 *   2. Callback server receives auth code, exchanges for tokens
 *   3. Tokens stored encrypted in figma_connections
 *   4. Push event sent to renderer
 *   5. Callback server shuts down
 *
 * Token refresh:
 *   getValidAccessToken(projectRoot) transparently refreshes if expired.
 *   Called by sync operations before making Figma API requests.
 */
export class FigmaOAuthService {
  constructor(
    connectionService: ConnectionService,
    crypto: TokenCrypto,
    mainWindow: BrowserWindow | null,
  )

  /**
   * Initiates the OAuth flow.
   * - Generates PKCE pair
   * - Starts loopback callback server
   * - Opens system browser to Figma authorization URL
   * Returns immediately. Completion notified via BrowserWindow.webContents.send().
   *
   * Throws if a flow is already in progress (single-flight guard).
   */
  startFlow(projectRoot: string, fileKey: string): Promise<{ status: 'pending' }>

  /**
   * Returns a decrypted, valid access token for the active connection.
   * If the token is expired, transparently refreshes it first.
   * If refresh fails, sets connection status to 'expired' and returns null.
   *
   * This is the ONLY method that should be called before Figma API requests.
   */
  getValidAccessToken(projectRoot: string): Promise<string | null>

  /**
   * Disconnects the OAuth connection for the given project.
   * Attempts to revoke the token with Figma (best-effort).
   * Clears local encrypted tokens.
   */
  disconnect(projectRoot: string): Promise<void>

  /**
   * Returns true if there's currently an OAuth flow in progress.
   */
  isFlowInProgress(): boolean

  /**
   * Forcefully cancels an in-progress flow (e.g., on timeout or app quit).
   * Shuts down the callback server if running.
   */
  cancelFlow(): void
}
```

---

## 10. Schema Migration

The `figma_connections` table needs one new column. Because SQLite does not
support `ALTER TABLE ... ADD COLUMN ... CHECK`, we add the column without a
CHECK constraint and enforce the enum at the application layer.

```sql
-- Applied in SyncSchema constructor (idempotent via try/catch on duplicate column)
ALTER TABLE figma_connections ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'pat';
```

The existing `refresh_token_encrypted` and `token_expiry` columns are already
present and correctly typed. No other DDL changes needed.

---

## 11. Figma OAuth Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://www.figma.com/oauth` | GET (browser) | Authorization page. Params: `client_id`, `redirect_uri`, `scope`, `state`, `response_type=code`, `code_challenge`, `code_challenge_method=S256` |
| `https://api.figma.com/v1/oauth/token` | POST | Exchange auth code for tokens. Body: `client_id`, `client_secret`, `redirect_uri`, `code`, `code_verifier`, `grant_type=authorization_code` |
| `https://api.figma.com/v1/oauth/refresh` | POST | Refresh expired token. Body: `client_id`, `client_secret`, `refresh_token` |
| `https://api.figma.com/v1/files/{fileKey}` | GET | Fetch file name (for display). Header: `Authorization: Bearer {token}` |

---

## 12. PKCE Implementation Detail

```typescript
// electron/figmaOAuth.ts -- pure functions, no side effects

import { randomBytes, createHash } from 'node:crypto'

function generateCodeVerifier(): string {
  // 96 random bytes -> 128 Base64URL characters
  return randomBytes(96)
    .toString('base64url')
    .slice(0, 128)
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url')
}

function generateState(): string {
  return randomUUID()
}
```

---

## 13. Loopback Callback Server Detail

```typescript
// electron/figmaOAuth.ts

import http from 'node:http'

/**
 * Starts a temporary HTTP server on 127.0.0.1 with an OS-assigned port.
 * The server handles exactly one request (the OAuth callback), then shuts down.
 *
 * Security:
 *   - Binds to 127.0.0.1 only (loopback). Same model as ingestion-server.ts.
 *   - Server auto-closes after receiving the callback or after 5-minute timeout.
 *   - Only GET /oauth/callback is handled; all other paths return 404.
 */
function startCallbackServer(
  expectedState: string,
  onCallback: (code: string) => void,
  onError: (error: Error) => void,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`)

      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(OAUTH_ERROR_HTML)
        onError(new Error(`Figma OAuth error: ${error}`))
        server.close()
        return
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(OAUTH_ERROR_HTML)
        onError(new Error('OAuth state mismatch (possible CSRF)'))
        server.close()
        return
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(OAUTH_ERROR_HTML)
        onError(new Error('No authorization code in callback'))
        server.close()
        return
      }

      // Serve a success page that auto-closes the browser tab
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(OAUTH_SUCCESS_HTML)
      onCallback(code)
      server.close()
    })

    // Bind to loopback only, OS-assigned port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (typeof addr === 'object' && addr !== null) {
        resolve({ server, port: addr.port })
      } else {
        reject(new Error('Failed to bind callback server'))
      }
    })

    // 5-minute timeout
    setTimeout(() => {
      server.close()
      onError(new Error('OAuth flow timed out (5 minutes)'))
    }, 5 * 60 * 1000)
  })
}

const OAUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Flint - Connected</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#18181b;color:#e4e4e7">
<div style="text-align:center">
<h1 style="color:#34d399;font-size:24px">Connected to Figma</h1>
<p style="color:#a1a1aa">You can close this tab and return to Flint Glass.</p>
<script>setTimeout(()=>window.close(),2000)</script>
</div></body></html>`

const OAUTH_ERROR_HTML = `<!DOCTYPE html>
<html><head><title>Flint - Error</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#18181b;color:#e4e4e7">
<div style="text-align:center">
<h1 style="color:#f87171;font-size:24px">Connection Failed</h1>
<p style="color:#a1a1aa">Please return to Flint Glass and try again.</p>
</div></body></html>`
```

---

## 14. Token Exchange Implementation

```typescript
// electron/figmaOAuth.ts

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  config: FigmaOAuthConfig,
): Promise<FigmaTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://api.figma.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<FigmaTokenResponse>
}

async function refreshAccessToken(
  refreshToken: string,
  config: FigmaOAuthConfig,
): Promise<FigmaTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',   // Figma uses standard refresh_token grant
  })

  const res = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<FigmaTokenResponse>
}
```

---

## 15. FigmaApiService Modification

The existing `FigmaApiService` uses `X-Figma-Token` for PAT authentication.
OAuth tokens use `Authorization: Bearer`. The service must support both.

```typescript
// flint-mcp/src/core/sync/figmaApiService.ts -- MODIFICATION

// Change the header construction in getFileVariables and updateFileVariables:

private buildAuthHeaders(accessToken: string, authMethod: AuthMethod): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (authMethod === 'oauth') {
    headers['Authorization'] = `Bearer ${accessToken}`
  } else {
    headers['X-Figma-Token'] = accessToken
  }
  return headers
}

// Update method signatures to accept authMethod parameter:
async getFileVariables(
  fileKey: string,
  accessToken: string,
  authMethod: AuthMethod = 'pat',
): Promise<FigmaVariablesResponse>
```

NOTE: This is a backward-compatible change. The default `authMethod = 'pat'`
preserves existing behavior for all current callers.

---

## 16. IPC Handler Implementations (electron/main.ts)

```typescript
// electron/main.ts -- new handlers in the IPC registration block

import { FigmaOAuthService } from './figmaOAuth.js'

// Module-level singleton, created after app.whenReady()
let figmaOAuthService: FigmaOAuthService | null = null

// In app.whenReady() or after window creation:
figmaOAuthService = new FigmaOAuthService(
  connectionService,      // existing ConnectionService instance
  safeStorageCrypto,      // existing TokenCrypto using safeStorage
  mainWindow,
)

// ── OAUTH.1: Figma OAuth IPC Handlers ───────────────────────────────────────

ipcMain.handle('figma:oauth:start', async (_event, payload) => {
  if (!activeProjectRoot) {
    return { status: 'error' as const, error: 'No project open' }
  }
  if (!figmaOAuthService) {
    return { status: 'error' as const, error: 'OAuth service not initialized' }
  }
  const { fileKey } = payload as { fileKey: string }
  if (!fileKey || typeof fileKey !== 'string') {
    return { status: 'error' as const, error: 'fileKey is required' }
  }
  try {
    return await figmaOAuthService.startFlow(activeProjectRoot, fileKey)
  } catch (err) {
    return { status: 'error' as const, error: String(err) }
  }
})

ipcMain.handle('figma:oauth:status', async () => {
  if (!activeProjectRoot) {
    return { connected: false, authMethod: null }
  }
  // Read from ConnectionService -- no tokens cross the boundary
  const conn = connectionService.getConnection(activeProjectRoot)
  if (!conn || conn.status === 'disconnected') {
    return { connected: false, authMethod: null }
  }
  return {
    connected: true,
    authMethod: conn.authMethod ?? 'pat',
    figmaFileName: conn.figmaFileName,
    figmaFileKey: conn.figmaFileKey,
    tokenExpired: conn.status === 'expired',
    connectedAt: conn.connectedAt,
    lastSyncAt: conn.lastSyncAt,
  }
})

ipcMain.handle('figma:oauth:disconnect', async () => {
  if (!activeProjectRoot || !figmaOAuthService) return
  await figmaOAuthService.disconnect(activeProjectRoot)
})
```

---

## 17. Preload Surface Additions (electron/preload.ts)

```typescript
// electron/preload.ts -- additions inside the figma namespace

figma: {
  // ... existing methods (status, disconnect, onConnected, onError, removeListeners) ...

  /** OAUTH.1: Initiates Figma OAuth flow. Opens system browser. */
  oauthStart: (payload: { fileKey: string }): Promise<{
    status: 'pending' | 'error'; error?: string
  }> => ipcRenderer.invoke('figma:oauth:start', payload),

  /** OAUTH.1: Returns current Figma connection status (no tokens). */
  oauthStatus: (): Promise<unknown> =>
    ipcRenderer.invoke('figma:oauth:status'),

  /** OAUTH.1: Disconnects Figma OAuth, revokes tokens. */
  oauthDisconnect: (): Promise<void> =>
    ipcRenderer.invoke('figma:oauth:disconnect'),

  /** OAUTH.1: Subscribe to OAuth flow completion. Returns unsubscribe fn. */
  onOAuthComplete: (callback: (event: {
    success: boolean; figmaFileName?: string; figmaFileKey?: string; error?: string
  }) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { success: boolean; figmaFileName?: string; figmaFileKey?: string; error?: string },
    ) => callback(data)
    ipcRenderer.on(ipcChannel('figma-oauth-complete'), listener)
    return () => {
      ipcRenderer.removeListener(ipcChannel('figma-oauth-complete'), listener)
    }
  },
},
```

---

## 18. Security Checklist

| # | Requirement | How Satisfied |
|---|------------|---------------|
| S1 | client_secret never in renderer | Stored in `electron/figmaOAuth.ts` module scope. Never exposed via IPC or preload. |
| S2 | PKCE prevents code interception | `code_verifier` generated per flow with `crypto.randomBytes(96)`. `code_challenge` is SHA-256 of verifier. |
| S3 | State parameter prevents CSRF | `randomUUID()` generated per flow. Callback server validates exact match. |
| S4 | Tokens encrypted at rest | Both `access_token` and `refresh_token` encrypted via `safeStorage.encryptString()` before SQLite write. |
| S5 | Tokens never cross IPC boundary | Only connection metadata (file name, status, expiry flag) sent to renderer. Actual tokens stay in main process. |
| S6 | Callback server is loopback-only | `server.listen(0, '127.0.0.1')` -- same security model as ingestion-server.ts. |
| S7 | Callback server has bounded lifetime | 5-minute timeout. Auto-closes after receiving one callback. |
| S8 | Token revocation on disconnect | `disconnect()` calls Figma's token revocation endpoint (best-effort, non-blocking). |
| S9 | Backward compatibility | Existing PAT connections continue working. `auth_method` column defaults to `'pat'`. All API changes have backward-compatible defaults. |
| S10 | No external URLs in preview (Commandment 4) | OAuth consent page opens in the system browser via `shell.openExternal()`, not in the Electron window or iframe. |

---

## 19. Commandment Checklist

| # | Commandment | Applies? | How Satisfied |
|---|-------------|----------|---------------|
| 4 | Local-First Only | Yes | OAuth consent in system browser. Token exchange + all API calls from local Electron process. No external content in preview. |
| 9 | CIEDE2000 Delta-E Logic | No | Not a visual/linting feature. |
| 12 | Atomic Queuing | Yes | Token storage goes through ConnectionService which writes to SQLite atomically. |
| 14 | Bypass Prohibition | Yes | No direct `fs` calls for token storage. All via ConnectionService + SQLite. |

Other commandments (1, 2, 3, 5-8, 10-11, 13, 15-16) do not apply to this feature
as it is purely an authentication/connection infrastructure change with no AST,
linting, or code generation involvement.

---

## 20. Implementation Order

### Group 1: Foundation (sequential, flint-electron-ipc)

1. **Modify `flint-mcp/src/core/sync/types.ts`** -- Add `'expired'` to
   `ConnectionStatus`, add `AuthMethod` type, add `authMethod` to
   `FigmaConnection` interface.

2. **Modify `flint-mcp/src/core/sync/syncSchema.ts`** -- Add idempotent
   `ALTER TABLE` migration for `auth_method` column.

3. **Modify `flint-mcp/src/core/sync/connectionService.ts`** -- Add
   `createOAuthConnection()`, `updateTokens()`, `isTokenExpired()` methods.

4. **Modify `flint-mcp/src/core/sync/figmaApiService.ts`** -- Add
   `buildAuthHeaders()` helper, update method signatures with optional
   `authMethod` parameter.

### Group 2: OAuth Service (flint-electron-ipc, can start after Group 1)

5. **Create `electron/figmaOAuth.ts`** -- Full OAuth service: PKCE generation,
   loopback callback server, token exchange, token refresh, encrypted storage.

6. **Modify `electron/main.ts`** -- Register `figma:oauth:start`,
   `figma:oauth:status`, `figma:oauth:disconnect` IPC handlers. Instantiate
   `FigmaOAuthService` singleton.

7. **Modify `electron/preload.ts`** -- Extend `figma` namespace with
   `oauthStart`, `oauthStatus`, `oauthDisconnect`, `onOAuthComplete`.

### Group 3: Types (flint-state-architect, parallel with Group 2)

8. **Modify `src/types/flint-api.d.ts`** -- Add `FigmaOAuthConnectionStatus`,
   `FigmaOAuthCompleteEvent` types. Extend `FigmaAPI` interface.

### Group 4: Glass UI (flint-design-engineer, after Groups 2 + 3)

9. **Modify `src/components/editor/StatusBar.tsx`** -- Add OAuth connection
   UI to Figma popover: "Connect with Figma" button, file key input,
   connection status display, PAT fallback link.

10. **Modify `src/components/ui/FigmaSetupWizard.tsx`** -- Add OAuth as
    primary Step 1 option, preserve existing plugin flow as secondary path.

### Group 5: Tests (flint-test-writer, parallel with Groups 2-4)

11. **Create `electron/__tests__/figmaOAuth.test.ts`** -- Unit tests for
    PKCE generation, callback server, token exchange mock, refresh logic,
    error handling, timeout, single-flight guard.

12. **Modify `src/components/editor/__tests__/StatusBar.test.tsx`** --
    Tests for OAuth button rendering, status display, file key extraction.

### Parallelism Diagram

```
Group 1 (sync types + schema + service)
   |
   +---> Group 2 (electron OAuth service + IPC + preload)
   |         |
   |         +---> Group 4 (Glass UI -- StatusBar + Wizard)
   |
   +---> Group 3 (renderer types) ──────────────────┘
   |
   +---> Group 5 (tests -- can start in parallel with Groups 2-4)
```

---

## 21. Risks

| Risk | Severity | Mitigation | Commandment Threatened |
|------|----------|-----------|----------------------|
| **Figma OAuth app registration is a manual prerequisite** | High | Must be done once by a Flint team member in the Figma developer console. Document the steps. `client_id` and `client_secret` must be embedded in the Electron build. | None (operational) |
| **client_secret in binary** | Medium | Desktop OAuth apps cannot fully protect client_secret. PKCE is the primary security mechanism. Consider using Figma's "public" OAuth flow if available (no client_secret). | None (industry standard for desktop apps) |
| **Port conflict on callback server** | Low | Using port 0 (OS-assigned ephemeral port). The redirect_uri is constructed dynamically after bind. | None |
| **safeStorage unavailable on Linux** | Low | `safeStorage.isEncryptionAvailable()` check. Fall back to identity crypto with a warning (same pattern as AI key storage in orchestrator.ts). | None |
| **Figma changes OAuth endpoints** | Low | All endpoint URLs are constants at the top of `figmaOAuth.ts`. Easy to update. | None |
| **Token refresh race condition** | Medium | Use a mutex/lock around `getValidAccessToken()` to prevent concurrent refreshes. Only one refresh in-flight at a time. | 12 (Atomic Queuing) |
| **Existing sync operations use PAT path** | Medium | `flint_sync_pull` and `flint_sync_push` MCP tools call `FigmaApiService` with the decrypted token from ConnectionService. They must be updated to call `FigmaOAuthService.getValidAccessToken()` when `authMethod === 'oauth'`, or the service must transparently handle this. The cleanest approach: create a unified `getAccessToken(projectRoot)` that handles both PAT decrypt and OAuth refresh. | 14 (Bypass Prohibition) |

---

## 22. What the User Must Do ONCE

Before this feature can work, a Flint team member must register Flint as a
Figma OAuth application:

1. Go to https://www.figma.com/developers/apps
2. Click "Create a new app"
3. Fill in:
   - **App name:** Flint Glass
   - **Website URL:** https://flint.dev (or your domain)
   - **Redirect URIs:** `http://localhost/oauth/callback`
     (Note: Figma may require a specific port. If so, use `http://127.0.0.1:19191/oauth/callback`
     and pin the callback server to port 19191 with fallback.)
   - **Scopes:** `files:read`, `file_variables:read`, `file_variables:write`
4. Save the `client_id` and `client_secret`
5. Add them to the Electron build configuration:
   - For development: `.env` file with `FLINT_FIGMA_CLIENT_ID` and `FLINT_FIGMA_CLIENT_SECRET`
   - For production: injected at build time via environment variables

The `client_id` is safe to ship in the binary (it's public). The `client_secret`
is more sensitive but standard practice for desktop OAuth apps to embed it.
PKCE is the actual security mechanism.

---

## 23. Test Plan

### Unit Tests (electron/__tests__/figmaOAuth.test.ts)

| Test | Description |
|------|-------------|
| `generateCodeVerifier returns 128-char base64url string` | Length and charset validation |
| `generateCodeChallenge produces correct S256 hash` | Known input/output pair |
| `startFlow rejects when flow already in progress` | Single-flight guard |
| `callback server binds to 127.0.0.1 only` | Verify address after listen |
| `callback server validates state parameter` | Mismatched state returns error |
| `callback server extracts auth code` | Valid callback with code + state |
| `callback server handles error parameter` | Figma returns ?error=access_denied |
| `callback server times out after 5 minutes` | Verify server closes on timeout |
| `exchangeCodeForTokens sends correct params` | Mock fetch, verify body |
| `exchangeCodeForTokens handles non-200 response` | Throws FigmaOAuthError |
| `refreshAccessToken sends correct params` | Mock fetch, verify body |
| `refreshAccessToken handles 401 (revoked)` | Sets connection to expired |
| `getValidAccessToken returns cached token when not expired` | No refresh call |
| `getValidAccessToken refreshes when expired` | Refresh called, new token returned |
| `getValidAccessToken handles concurrent calls` | Mutex prevents double refresh |
| `disconnect revokes token and clears connection` | Mock revocation endpoint |
| `disconnect handles revocation failure gracefully` | Best-effort, no throw |
| `createOAuthConnection stores encrypted tokens` | Verify DB row fields |
| `updateTokens updates expiry and encrypted tokens` | Verify DB update |
| `isTokenExpired returns true when past expiry` | Time-based check |
| `isTokenExpired returns false for PAT connections` | PAT has null expiry |

### Integration Tests (StatusBar + FigmaSetupWizard)

| Test | Description |
|------|-------------|
| `StatusBar renders "Connect with Figma" when not connected` | Button visibility |
| `StatusBar shows connected state with file name` | OAuth status polling |
| `StatusBar shows "expired" badge when token expired` | Expired status rendering |
| `FigmaSetupWizard shows OAuth as primary option` | Step 1 layout |
| `File key extraction from Figma URL` | Regex parsing of various URL formats |
| `OAuth button calls oauthStart with fileKey` | Click handler verification |
| `onOAuthComplete updates UI on success` | Push event handling |
| `onOAuthComplete shows error on failure` | Error notification |

### Manual Test Checklist

- [ ] Click "Connect with Figma" -- browser opens to Figma authorization page
- [ ] Authorize in Figma -- browser shows success page, Flint popover updates
- [ ] Close and reopen Flint -- connection persists (encrypted in SQLite)
- [ ] Wait for token expiry -- next sync operation transparently refreshes
- [ ] Click "Disconnect" -- connection cleared, UI resets to unconnected state
- [ ] Cancel OAuth flow (close browser tab) -- 5-minute timeout fires, UI shows error
- [ ] Test on macOS, Windows, Linux -- `shell.openExternal` and `safeStorage` both work
- [ ] Test with PAT fallback -- "Use Personal Access Token" link still works
- [ ] Test concurrent flows -- second click shows "already in progress" error

---

## 24. Open Design Questions

1. **Figma redirect URI format:** Figma's OAuth docs may require a fixed redirect
   URI registered in the developer console. If they don't support wildcard ports,
   we must pin to a specific port (e.g., 19191) with fallback. Verify during
   Figma app registration.

2. **Public OAuth flow:** Figma may support a "public" OAuth flow for desktop
   apps that doesn't require `client_secret`. If available, this eliminates
   Risk #2 entirely. Check Figma's current developer documentation.

3. **File key acquisition:** The current design requires the user to paste a
   Figma file URL. A future enhancement could let the user browse their Figma
   files after OAuth authorization (GET /v1/me/files) and select one from a list.
   This is out of scope for OAUTH.1 but noted as a follow-up.
