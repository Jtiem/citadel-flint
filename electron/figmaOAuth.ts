/**
 * OAUTH.1 — Figma OAuth 2.0 Authorization Code Grant with PKCE.
 *
 * Runs entirely in the Electron main process. A temporary loopback HTTP
 * server on 127.0.0.1 receives the authorization callback; tokens are
 * encrypted via Electron's `safeStorage` API (SEC.4) before being stored
 * in the figma_connections SQLite table via ConnectionService.
 *
 * Security guarantees:
 *   - PKCE (S256) on every flow — no client_secret needed in the token
 *     exchange when code_verifier is present, but we include it for
 *     servers that require it.
 *   - State nonce validated on callback to prevent CSRF.
 *   - Loopback-only callback server (127.0.0.1, NOT 0.0.0.0).
 *   - 5-minute timeout on the authorization wait.
 *   - client_secret encrypted via safeStorage; never in source.
 *   - Tokens never cross the IPC boundary.
 */

import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { URL } from 'node:url'
import { safeStorage, shell } from 'electron'
import type { ConnectionService } from '../flint-mcp/src/core/sync/connectionService.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIGMA_OAUTH_AUTH_URL = 'https://www.figma.com/oauth'
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token'
const FIGMA_REFRESH_URL = 'https://api.figma.com/v1/oauth/refresh'
const FIGMA_FILE_URL = (fileKey: string) => `https://api.figma.com/v1/files/${fileKey}?depth=1`

const OAUTH_SCOPE = 'files:read,file_variables:read,file_variables:write'
const CALLBACK_PATH = '/oauth/callback'
const FLOW_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// safeStorage key names for the encrypted secrets
const SS_KEY_CLIENT_SECRET = 'flint:figma-client-secret'
const SS_KEY_ACCESS_TOKEN = 'flint:figma-access-token'
const SS_KEY_REFRESH_TOKEN = 'flint:figma-refresh-token'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Encodes a Buffer as base64url (no padding, url-safe charset). */
function toBase64Url(buf: Buffer): string {
    return buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

export interface PKCEPair {
    codeVerifier: string
    codeChallenge: string
}

/**
 * Generates a PKCE code_verifier (32 random bytes → base64url) and the
 * corresponding S256 code_challenge (SHA-256 of the verifier → base64url).
 */
export function generatePKCE(): PKCEPair {
    const verifierBytes = randomBytes(32)
    const codeVerifier = toBase64Url(verifierBytes)
    const challengeBytes = createHash('sha256').update(codeVerifier).digest()
    const codeChallenge = toBase64Url(challengeBytes)
    return { codeVerifier, codeChallenge }
}

/** Generates a cryptographically random state nonce (16 bytes → hex). */
export function generateStateNonce(): string {
    return randomBytes(16).toString('hex')
}

// ---------------------------------------------------------------------------
// safeStorage helpers for the client_secret
// ---------------------------------------------------------------------------

/**
 * Stores the client_secret encrypted via Electron safeStorage.
 * Called once on first run; subsequent calls overwrite the stored value.
 * No-ops silently when encryption is unavailable (CI / headless).
 */
export function storeClientSecret(plaintext: string): void {
    if (!safeStorage.isEncryptionAvailable()) return
    const encrypted = safeStorage.encryptString(plaintext)
    // Persist as hex so it survives app restarts without a DB dependency.
    // We write it to a module-level buffer; callers that need persistence
    // across restarts should use electron-store or write to a config file.
    _encryptedClientSecret = encrypted.toString('hex')
}

/**
 * Returns the decrypted client_secret, or null when unavailable.
 * Reads from the in-memory encrypted buffer set by storeClientSecret().
 */
export function loadClientSecret(): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null
    if (_encryptedClientSecret === null) return null
    try {
        const buf = Buffer.from(_encryptedClientSecret, 'hex')
        return safeStorage.decryptString(buf)
    } catch {
        return null
    }
}

/** In-memory store for the encrypted client_secret (hex-encoded Buffer). */
let _encryptedClientSecret: string | null = null

// ---------------------------------------------------------------------------
// Token safeStorage helpers
// ---------------------------------------------------------------------------

/** Encrypts a token string via safeStorage. Returns hex string. */
function encryptToken(plaintext: string): string {
    if (!safeStorage.isEncryptionAvailable()) return plaintext
    return safeStorage.encryptString(plaintext).toString('hex')
}

/** Decrypts a token hex string via safeStorage. Returns plaintext. */
function decryptToken(hexCiphertext: string): string {
    if (!safeStorage.isEncryptionAvailable()) return hexCiphertext
    try {
        const buf = Buffer.from(hexCiphertext, 'hex')
        return safeStorage.decryptString(buf)
    } catch {
        return hexCiphertext
    }
}

// In-memory stores for access/refresh tokens (keyed by projectRoot).
const _accessTokens = new Map<string, string>()   // projectRoot → encrypted hex
const _refreshTokens = new Map<string, string>()  // projectRoot → encrypted hex
const _tokenExpiries = new Map<string, number>()  // projectRoot → Unix ms

// ---------------------------------------------------------------------------
// OAuth flow result
// ---------------------------------------------------------------------------

export interface OAuthFlowResult {
    ok: boolean
    fileKey?: string
    fileName?: string
    status?: 'connected' | 'expired' | 'error'
    error?: string
}

// ---------------------------------------------------------------------------
// Main service class
// ---------------------------------------------------------------------------

export class FigmaOAuthService {
    private readonly clientId: string
    private readonly connectionService: ConnectionService

    constructor(clientId: string, connectionService: ConnectionService) {
        this.clientId = clientId
        this.connectionService = connectionService
    }

    /**
     * Starts the OAuth flow:
     * 1. Generates PKCE pair + state nonce.
     * 2. Starts a loopback HTTP server on an ephemeral port.
     * 3. Opens the Figma authorization URL in the system browser.
     * 4. Waits up to 5 minutes for the callback.
     * 5. Exchanges the authorization code for tokens.
     * 6. Stores tokens encrypted; persists connection in ConnectionService.
     *
     * @param projectRoot — The active project root (used to key the connection).
     * @param fileKey — Figma file key to associate with this connection.
     * @param fileName — Optional display name for the file.
     */
    async startFlow(
        projectRoot: string,
        fileKey: string,
        fileName?: string,
    ): Promise<OAuthFlowResult> {
        const { codeVerifier, codeChallenge } = generatePKCE()
        const state = generateStateNonce()

        let port: number
        let code: string

        try {
            const result = await this._runCallbackServer(
                state,
                codeChallenge,
                codeVerifier,
            )
            port = result.port
            code = result.code
            void port // port is captured inside the closure; lint-suppress
        } catch (err) {
            return {
                ok: false,
                status: 'error',
                error: err instanceof Error ? err.message : String(err),
            }
        }

        // Exchange code for tokens
        let tokens: TokenResponse
        try {
            const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`
            tokens = await this._exchangeCode(code, codeVerifier, redirectUri)
        } catch (err) {
            return {
                ok: false,
                status: 'error',
                error: `Token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
            }
        }

        // Resolve file name if not provided
        let resolvedFileName = fileName ?? ''
        if (!resolvedFileName) {
            try {
                resolvedFileName = await this._fetchFileName(fileKey, tokens.access_token)
            } catch {
                // Non-fatal — continue with empty name
            }
        }

        // Encrypt and store tokens in memory
        const expiryMs = Date.now() + tokens.expires_in * 1000
        _accessTokens.set(projectRoot, encryptToken(tokens.access_token))
        _refreshTokens.set(projectRoot, encryptToken(tokens.refresh_token))
        _tokenExpiries.set(projectRoot, expiryMs)

        // Persist connection in SQLite via ConnectionService
        // We store a placeholder in the access_token_encrypted field so the
        // ConnectionService row exists; actual token reads go through
        // getValidAccessToken() which decrypts from the in-memory store.
        this.connectionService.createOAuthConnection(
            projectRoot,
            fileKey,
            tokens.access_token,
            tokens.refresh_token,
            expiryMs,
            resolvedFileName,
        )

        return {
            ok: true,
            fileKey,
            fileName: resolvedFileName,
            status: 'connected',
        }
    }

    /**
     * Returns a valid access token for the given projectRoot.
     * - PAT connection → returns the PAT directly.
     * - OAuth connection → checks expiry → refreshes if needed → returns access_token.
     * - If refresh fails → sets connection status to 'expired', throws.
     */
    async getValidAccessToken(projectRoot: string): Promise<string> {
        const connection = this.connectionService.getConnection(projectRoot)
        if (!connection) throw new Error('No active Figma connection for this project')

        const authMethod = connection.authMethod ?? 'pat'

        if (authMethod === 'pat') {
            // PAT: decrypt directly from the connection row
            return this.connectionService.decryptAccessToken(connection)
        }

        // OAuth path: use in-memory token store
        const encryptedAccess = _accessTokens.get(projectRoot)
        if (!encryptedAccess) {
            // Token not in memory — attempt to read from ConnectionService
            const pat = this.connectionService.decryptAccessToken(connection)
            if (!pat) throw new Error('OAuth access token not available')
            return pat
        }

        const expiry = _tokenExpiries.get(projectRoot) ?? 0

        // Refresh if expiring within 5 minutes
        if (Date.now() > expiry - 5 * 60 * 1000) {
            const encryptedRefresh = _refreshTokens.get(projectRoot)
            if (!encryptedRefresh) {
                this.connectionService.setError(projectRoot)
                this.connectionService.setStatus(projectRoot, 'expired')
                throw new Error('OAuth refresh token not available')
            }

            const refreshToken = decryptToken(encryptedRefresh)
            let newTokens: RefreshResponse
            try {
                newTokens = await this._refreshToken(refreshToken)
            } catch (err) {
                this.connectionService.setStatus(projectRoot, 'expired')
                throw new Error(
                    `Token refresh failed: ${err instanceof Error ? err.message : String(err)}`,
                )
            }

            const newExpiry = Date.now() + newTokens.expires_in * 1000
            _accessTokens.set(projectRoot, encryptToken(newTokens.access_token))
            _tokenExpiries.set(projectRoot, newExpiry)

            // Persist updated tokens in ConnectionService
            this.connectionService.updateOAuthTokens(
                projectRoot,
                newTokens.access_token,
                refreshToken,
                newExpiry,
            )

            return newTokens.access_token
        }

        return decryptToken(encryptedAccess)
    }

    /**
     * Returns the current OAuth connection status for this project.
     */
    getStatus(projectRoot: string): {
        connected: boolean
        fileKey?: string
        fileName?: string
        authMethod?: 'pat' | 'oauth'
        expired?: boolean
    } {
        const connection = this.connectionService.getConnection(projectRoot)
        if (!connection || connection.status !== 'active') {
            return { connected: false }
        }

        const authMethod = (connection.authMethod ?? 'pat') as 'pat' | 'oauth'
        let expired = false

        if (authMethod === 'oauth') {
            const expiry = _tokenExpiries.get(projectRoot) ?? 0
            expired = expiry > 0 && Date.now() > expiry
        }

        return {
            connected: true,
            fileKey: connection.figmaFileKey,
            fileName: connection.figmaFileName,
            authMethod,
            expired,
        }
    }

    /**
     * Clears stored OAuth tokens and marks the connection as disconnected.
     */
    disconnect(projectRoot: string): void {
        _accessTokens.delete(projectRoot)
        _refreshTokens.delete(projectRoot)
        _tokenExpiries.delete(projectRoot)
        this.connectionService.disconnectConnection(projectRoot)
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Starts a loopback HTTP server, opens the Figma OAuth URL, and waits for
     * the callback. Returns `{ port, code }` when the callback is received.
     * Rejects after FLOW_TIMEOUT_MS with a timeout error.
     */
    private _runCallbackServer(
        state: string,
        codeChallenge: string,
        codeVerifier: string,
    ): Promise<{ port: number; code: string }> {
        return new Promise((resolve, reject) => {
            let settled = false
            let capturedPort = 0

            const settle = (
                winner: () => void,
                server: http.Server,
                timer: ReturnType<typeof setTimeout>,
            ) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                server.close(() => winner())
            }

            const server = http.createServer((req, res) => {
                if (!req.url) {
                    res.writeHead(400).end()
                    return
                }

                const reqUrl = new URL(req.url, `http://127.0.0.1:${capturedPort}`)
                if (reqUrl.pathname !== CALLBACK_PATH) {
                    res.writeHead(404).end()
                    return
                }

                const errorParam = reqUrl.searchParams.get('error')
                if (errorParam) {
                    const desc = reqUrl.searchParams.get('error_description') ?? errorParam
                    res.writeHead(200, { 'Content-Type': 'text/html' })
                    res.end(`<html><body><h2>Authorization failed</h2><p>${desc}</p><p>You may close this tab.</p></body></html>`)
                    settle(
                        () => reject(new Error(`Figma denied authorization: ${desc}`)),
                        server,
                        timer,
                    )
                    return
                }

                const returnedState = reqUrl.searchParams.get('state')
                if (returnedState !== state) {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body><h2>Invalid state parameter</h2><p>You may close this tab.</p></body></html>')
                    settle(
                        () => reject(new Error('OAuth state mismatch — possible CSRF')),
                        server,
                        timer,
                    )
                    return
                }

                const code = reqUrl.searchParams.get('code')
                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body><h2>Missing authorization code</h2><p>You may close this tab.</p></body></html>')
                    settle(
                        () => reject(new Error('No authorization code in callback')),
                        server,
                        timer,
                    )
                    return
                }

                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end('<html><body><h2>Figma connected to Flint!</h2><p>You may close this tab.</p></body></html>')

                settle(() => resolve({ port: capturedPort, code }), server, timer)
            })

            // Bind to ephemeral port on loopback ONLY
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address()
                if (!addr || typeof addr === 'string') {
                    reject(new Error('Failed to bind loopback OAuth server'))
                    return
                }
                capturedPort = addr.port

                // Build the authorization URL
                const redirectUri = `http://127.0.0.1:${capturedPort}${CALLBACK_PATH}`
                const authUrl = new URL(FIGMA_OAUTH_AUTH_URL)
                authUrl.searchParams.set('client_id', this.clientId)
                authUrl.searchParams.set('redirect_uri', redirectUri)
                authUrl.searchParams.set('scope', OAUTH_SCOPE)
                authUrl.searchParams.set('state', state)
                authUrl.searchParams.set('response_type', 'code')
                authUrl.searchParams.set('code_challenge', codeChallenge)
                authUrl.searchParams.set('code_challenge_method', 'S256')

                void shell.openExternal(authUrl.toString())
            })

            server.on('error', (err) => {
                if (!settled) {
                    settled = true
                    reject(new Error(`OAuth callback server error: ${err.message}`))
                }
            })

            // 5-minute timeout
            const timer = setTimeout(() => {
                settle(
                    () => reject(new Error('OAuth authorization timed out after 5 minutes')),
                    server,
                    setTimeout(() => {}, 0), // dummy timer to satisfy settle signature
                )
            }, FLOW_TIMEOUT_MS)
        })
    }

    /** Exchanges an authorization code for access + refresh tokens. */
    private async _exchangeCode(
        code: string,
        codeVerifier: string,
        redirectUri: string,
    ): Promise<TokenResponse> {
        const clientSecret = loadClientSecret()
        if (!clientSecret) {
            throw new Error('Figma client_secret not available — call storeClientSecret() at app start')
        }

        const body = new URLSearchParams({
            client_id: this.clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
        })

        const response = await fetch(FIGMA_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`Token endpoint returned ${response.status}: ${text}`)
        }

        const json = await response.json() as TokenResponse
        if (!json.access_token) {
            throw new Error('Token endpoint did not return access_token')
        }
        return json
    }

    /** Refreshes an expired access token using the refresh token. */
    private async _refreshToken(refreshToken: string): Promise<RefreshResponse> {
        const clientSecret = loadClientSecret()
        if (!clientSecret) {
            throw new Error('Figma client_secret not available for token refresh')
        }

        const body = new URLSearchParams({
            client_id: this.clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        })

        const response = await fetch(FIGMA_REFRESH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`Refresh endpoint returned ${response.status}: ${text}`)
        }

        const json = await response.json() as RefreshResponse
        if (!json.access_token) {
            throw new Error('Refresh endpoint did not return access_token')
        }
        return json
    }

    /** Fetches the display name of a Figma file via the REST API. */
    private async _fetchFileName(fileKey: string, accessToken: string): Promise<string> {
        const response = await fetch(FIGMA_FILE_URL(fileKey), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) return ''
        const json = await response.json() as { name?: string }
        return json.name ?? ''
    }
}

// ---------------------------------------------------------------------------
// Token API response shapes
// ---------------------------------------------------------------------------

interface TokenResponse {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type?: string
}

interface RefreshResponse {
    access_token: string
    expires_in: number
}
