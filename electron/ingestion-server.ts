/**
 * Ingestion Server — electron/ingestion-server.ts
 *
 * A local HTTP server that receives payloads from the Figma plugin,
 * persists them to SQLite, and notifies the renderer via IPC.
 *
 * Security model:
 *   - Only listens on loopback (127.0.0.1) — never reachable from the network.
 *   - Access-Control-Allow-Origin is set to '*'. This is safe because the server
 *     is loopback-only; wildcard CORS is required for Figma plugin iframes, which
 *     present a 'null' origin that cannot be matched by a specific origin string.
 *   - Every non-OPTIONS request must supply a matching x-flint-secret header.
 *   - SEC.6: Per-route token-bucket rate limiting prevents DoS from misbehaving
 *     plugins or scripts. OPTIONS (CORS preflight) requests are always exempt.
 *
 * Routes:
 *   POST /ingest         — Accepts a Figma Variables payload, normalises to W3C
 *                          DTCG format, and batch-upserts into design_tokens.
 *   POST /ingest-asset   — Legacy: stores base64 image data in assets_cache.
 *
 * This module runs in the Main Process only.
 */

import http from 'node:http'
import { BrowserWindow } from 'electron'
import db from './store.js'
import { normalizeFigmaVariables } from './normalizer.js'
import { heal } from './ingestion/index.js'
import type { AuditorToken } from './ingestion/index.js'
// SEC.6: Rate limiter lives in a pure module with no Electron/SQLite imports
// so it can be unit-tested in isolation.
import { checkRateLimit } from './rateLimiter.js'
import { BRAND, ipcChannel } from '../shared/brand.ts'

const BASE_PORT = 4545
const MAX_PORT_ATTEMPTS = 10

// SEC.2: Secret is no longer a compile-time constant. It is injected at runtime
// by main.ts via startIngestionServer(secret) using crypto.randomBytes(32).
// This prevents the hardcoded secret from shipping in the binary.
let flintSecret: string | null = null

let server: http.Server | null = null
let activePort = BASE_PORT

/**
 * Server-side callback for storing pre-heal code (SECURITY-01 fix).
 * Set by main.ts via `setPreHealCodeCallback()` to avoid circular imports.
 * Defaults to no-op so ingestion-server works standalone in tests.
 */
let _storePreHealCode: (code: string) => void = () => {}

/** Called by main.ts to wire the pre-heal code store without circular import. */
export function setPreHealCodeCallback(cb: (code: string) => void): void {
    _storePreHealCode = cb
}

/**
 * Unix timestamp (ms) of the last successful POST /ingest from the Figma plugin.
 * null means no ingest has occurred in this process lifetime.
 */
let lastWebhookAt: number | null = null

// ── Prepared statements (created once, reused on every request) ───────────────

const upsertAsset = db.prepare(
    'INSERT OR REPLACE INTO assets_cache (id, base64_data) VALUES (?, ?)'
)

const upsertToken = db.prepare<[string, string, string, string | null, string, string]>(`
    INSERT INTO design_tokens
        (token_path, token_type, token_value, description, mode, collection_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_path, mode, collection_name) DO UPDATE SET
        token_value = excluded.token_value,
        description = excluded.description,
        updated_at  = strftime('%s', 'now')
`)

/** Batch-upserts all tokens inside a single SQLite transaction for atomicity + speed. */
const batchUpsertTokens = db.transaction(
    (tokens: ReturnType<typeof normalizeFigmaVariables>) => {
        for (const t of tokens) {
            upsertToken.run(
                t.token_path,
                t.token_type,
                t.token_value,
                t.description ?? null,
                t.mode ?? 'default',
                t.collection_name ?? 'default',
            )
        }
    }
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function setCorsHeaders(res: http.ServerResponse): void {
    // Wildcard is safe because the server binds to 127.0.0.1 only.
    // It is also required for Figma plugin iframes, which present a 'null'
    // origin that cannot be matched by a specific origin string.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', `Content-Type, ${BRAND.secretHeader}`)
    res.setHeader('Access-Control-Max-Age', '86400')
}

function sendJson(
    res: http.ServerResponse,
    status: number,
    body: object
): void {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
    })
    res.end(payload)
}

/** Strip a data-URI prefix (e.g. "data:image/png;base64,") if present. */
function normaliseBase64(raw: string): string {
    const commaIndex = raw.indexOf(',')
    return commaIndex !== -1 ? raw.slice(commaIndex + 1) : raw
}

// ── Request handler ───────────────────────────────────────────────────────────

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    setCorsHeaders(res)

    // 1. Handle OPTIONS preflight — must return 200 before any auth checks
    //    OPTIONS is always exempt from rate limiting (CORS preflight must always succeed).
    if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
    }

    // SEC.6: Per-route rate limit check — runs before secret validation so
    // unauthenticated flood attempts are rejected cheaply.
    const rateResult = checkRateLimit(req.url)
    if (!rateResult.allowed) {
        const secs = rateResult.retryAfterSecs
        res.setHeader('Retry-After', String(secs))
        sendJson(res, 429, { error: `Rate limit exceeded. Try again in ${secs}s.` })
        return
    }

    // SEC.2: Guard against requests arriving before startIngestionServer sets the secret
    if (flintSecret === null) {
        sendJson(res, 503, { error: 'Server not fully initialized' })
        return
    }

    // 2. Enforce secret header on all other methods
    const secret = req.headers[BRAND.secretHeader]
    if (!secret || secret !== flintSecret) {
        const unauthorizedReason = `Unauthorized: missing or invalid ${BRAND.secretHeader}`
        sendJson(res, 401, { error: unauthorizedReason })
        const errWindows = BrowserWindow.getAllWindows()
        if (errWindows.length > 0) {
            errWindows[0].webContents.send(ipcChannel('figma-error'), {
                statusCode: 401,
                reason: unauthorizedReason,
                timestamp: Date.now(),
            })
        }
        return
    }

    // 3. Route: POST /ingest — Figma Variables → design_tokens UPSERT
    if (req.method === 'POST' && req.url === '/ingest') {
        let rawBody = ''

        req.on('data', (chunk: Buffer) => {
            rawBody += chunk.toString('utf8')
            // 10 MB ceiling — token payloads are text-only and should be well under this
            if (rawBody.length > 10 * 1024 * 1024) {
                req.destroy()
            }
        })

        req.on('end', () => {
            try {
                const payload: unknown = JSON.parse(rawBody)
                const tokens = normalizeFigmaVariables(payload)

                if (tokens.length === 0) {
                    const emptyReason = 'No tokens produced. Verify the payload contains ' +
                        'variables and variableCollections keys.'
                    sendJson(res, 400, { error: emptyReason })
                    const badWindows = BrowserWindow.getAllWindows()
                    if (badWindows.length > 0) {
                        badWindows[0].webContents.send(ipcChannel('figma-error'), {
                            statusCode: 400,
                            reason: emptyReason,
                            timestamp: Date.now(),
                        })
                    }
                    return
                }

                batchUpsertTokens(tokens)

                // Record timestamp of this successful ingest for getFigmaStatus().
                lastWebhookAt = Date.now()

                // Notify the renderer so the token store re-fetches automatically.
                const windows = BrowserWindow.getAllWindows()
                if (windows.length > 0) {
                    windows[0].webContents.send(ipcChannel('tokens-updated'))
                    // Push connection event so FigmaSetupWizard / StatusBar can react.
                    windows[0].webContents.send(ipcChannel('figma-connected'), {
                        tokenCount: tokens.length,
                        timestamp: lastWebhookAt,
                    })
                }

                console.log(`${BRAND.logPrefix} /ingest: upserted ${tokens.length} tokens`)
                sendJson(res, 200, { success: true, count: tokens.length })
            } catch {
                const parseReason = 'Invalid JSON payload'
                sendJson(res, 400, { error: parseReason })
                const parseErrWindows = BrowserWindow.getAllWindows()
                if (parseErrWindows.length > 0) {
                    parseErrWindows[0].webContents.send(ipcChannel('figma-error'), {
                        statusCode: 400,
                        reason: parseReason,
                        timestamp: Date.now(),
                    })
                }
            }
        })

        req.on('error', () => {
            sendJson(res, 500, { error: 'Request stream error' })
        })

        return
    }

    // 4. Route: POST /ingest-asset — base64 image data → assets_cache
    if (req.method === 'POST' && req.url === '/ingest-asset') {
        let rawBody = ''

        req.on('data', (chunk: Buffer) => {
            rawBody += chunk.toString('utf8')
            // Rudimentary guard against absurdly large payloads (50 MB)
            if (rawBody.length > 50 * 1024 * 1024) {
                req.destroy()
            }
        })

        req.on('end', () => {
            try {
                const payload = JSON.parse(rawBody) as {
                    id?: unknown
                    imageData?: unknown
                }

                if (typeof payload.id !== 'string' || typeof payload.imageData !== 'string') {
                    sendJson(res, 400, { error: 'Payload must include string fields: id, imageData' })
                    return
                }

                const base64Data = normaliseBase64(payload.imageData)
                upsertAsset.run(payload.id, base64Data)

                // Notify the renderer so the canvas can display the new asset
                const windows = BrowserWindow.getAllWindows()
                if (windows.length > 0) {
                    windows[0].webContents.send('figma-asset-received', { id: payload.id })
                }

                console.log(`${BRAND.logPrefix} Asset ingested: ${payload.id}`)
                sendJson(res, 200, { success: true, id: payload.id })
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON payload' })
            }
        })

        req.on('error', () => {
            sendJson(res, 500, { error: 'Request stream error' })
        })

        return
    }

    // 5. Route: POST /ingest-ast — Figma AST payload → notify renderer
    if (req.method === 'POST' && req.url === '/ingest-ast') {
        let rawBody = ''

        req.on('data', (chunk: Buffer) => {
            rawBody += chunk.toString('utf8')
            if (rawBody.length > 10 * 1024 * 1024) {
                req.destroy()
            }
        })

        req.on('end', () => {
            try {
                const payload = JSON.parse(rawBody)

                // For /ingest-ast, the plugin sends { type, payload } where payload is the AST JSON string
                // or just the AST JSON string directly. We'll handle both.
                let figmaPayload: string;
                if (payload && payload.type === 'application/x-flint-figma-ast') {
                    figmaPayload = typeof payload.payload === 'string'
                        ? payload.payload
                        : JSON.stringify(payload.payload)
                } else {
                    figmaPayload = rawBody
                }

                // ── Phase ING.1: Ingestion Heal Pass ─────────────────────────────────
                // Read tokens synchronously from SQLite (better-sqlite3).
                // If empty (no prior /ingest), heal() is a safe no-op.
                let healedPayload = figmaPayload
                try {
                    const tokenRows = db.prepare(
                        'SELECT token_path, token_type, token_value FROM design_tokens'
                    ).all() as AuditorToken[]
                    const healResult = heal(figmaPayload, tokenRows)
                    healedPayload = healResult.healedCode
                    // Store pre-heal code server-side for undo (SECURITY-01 fix)
                    _storePreHealCode(figmaPayload)
                    const healWindows = BrowserWindow.getAllWindows()
                    if (healWindows.length > 0) {
                        healWindows[0].webContents.send(ipcChannel('import-summary'), healResult.summary)
                    }
                    console.log(
                        `${BRAND.logPrefix} /ingest-ast: heal pass — ` +
                        `tier1=${healResult.summary.tier1Fixed.length} ` +
                        `tier2=${healResult.summary.tier2Flagged.length} ` +
                        `tier3=${healResult.summary.tier3Unknown} ` +
                        `(${healResult.summary.healTimeMs.toFixed(1)}ms)`
                    )
                } catch (healErr) {
                    // Never block ingestion on heal errors — degrade gracefully
                    console.error(`${BRAND.logPrefix} /ingest-ast: heal error (raw payload used):`, healErr)
                }
                // ── End ING.1 ────────────────────────────────────────────────────────

                // ── FIGMA-MAP.2: Extract and persist component ID mappings ────────
                try {
                    const parsedPayload = typeof healedPayload === 'string' ? JSON.parse(healedPayload) : healedPayload
                    /** Minimal structural interface for Figma ingestion nodes. */
                    interface FigmaIngestionNode {
                        figmaComponentId?: string
                        figmaComponent?: string
                        figmaFileKey?: string
                        children?: FigmaIngestionNode[]
                        [key: string]: unknown
                    }

                    const figmaComponents: Array<{ id: string; name: string; fileKey: string }> = []
                    const extractIds = (node: FigmaIngestionNode) => {
                        if (node?.figmaComponentId && node?.figmaComponent) {
                            figmaComponents.push({
                                id: node.figmaComponentId,
                                name: node.figmaComponent,
                                fileKey: node.figmaFileKey ?? 'unknown',
                            })
                        }
                        if (Array.isArray(node?.children)) {
                            for (const child of node.children) extractIds(child)
                        }
                    }
                    extractIds(parsedPayload as FigmaIngestionNode)

                    if (figmaComponents.length > 0) {
                        // Persist mappings to SQLite
                        const createTable = db.prepare(`
                            CREATE TABLE IF NOT EXISTS figma_component_mappings (
                                figma_component_id TEXT PRIMARY KEY,
                                figma_file_key TEXT NOT NULL,
                                figma_component_name TEXT NOT NULL,
                                project_component_name TEXT NOT NULL DEFAULT '',
                                confidence TEXT NOT NULL DEFAULT 'auto-name',
                                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                            )
                        `)
                        createTable.run()

                        const upsert = db.prepare(`
                            INSERT INTO figma_component_mappings (figma_component_id, figma_file_key, figma_component_name, updated_at)
                            VALUES (?, ?, ?, datetime('now'))
                            ON CONFLICT(figma_component_id) DO UPDATE SET
                                figma_component_name = excluded.figma_component_name,
                                updated_at = datetime('now')
                        `)
                        for (const fc of figmaComponents) {
                            upsert.run(fc.id, fc.fileKey, fc.name)
                        }
                        console.log(`${BRAND.logPrefix} FIGMA-MAP: persisted ${figmaComponents.length} component ID mapping(s)`)
                    }
                } catch (mapErr) {
                    console.error(`${BRAND.logPrefix} FIGMA-MAP: component ID extraction failed (non-blocking):`, mapErr)
                }
                // ── End FIGMA-MAP.2 ──────────────────────────────────────────────────

                // Send healed code (or raw payload on heal error) to renderer
                const windows = BrowserWindow.getAllWindows()
                if (windows.length > 0) {
                    windows[0].webContents.send(ipcChannel('hydro-paste-auto'), healedPayload)
                }

                console.log(`${BRAND.logPrefix} /ingest-ast: payload dispatched to renderer`)
                sendJson(res, 200, { success: true })
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON payload' })
            }
        })

        req.on('error', () => {
            sendJson(res, 500, { error: 'Request stream error' })
        })

        return
    }

    // 6. Fallthrough — 404
    sendJson(res, 404, { error: `Route not found: ${req.method} ${req.url}` })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempts to bind the server to `port`. On EADDRINUSE it increments by 1
 * and retries until a free port is found or MAX_PORT_ATTEMPTS is exceeded.
 * Each failed attempt closes its http.Server before creating a fresh one
 * (a Node.js Server in error state cannot be rebound).
 */
function tryListen(port: number): void {
    if (port > BASE_PORT + MAX_PORT_ATTEMPTS) {
        console.error(
            `${BRAND.logPrefix} Could not bind to any port in range ${BASE_PORT}–${BASE_PORT + MAX_PORT_ATTEMPTS}. Ingestion server not started.`
        )
        return
    }

    const attempt = http.createServer(handleRequest)

    attempt.listen(port, '127.0.0.1', () => {
        server = attempt
        activePort = port
        console.log(`${BRAND.logPrefix} Ingestion server listening on http://127.0.0.1:${port}`)
        // SEC.2: Do NOT log the secret. It stays in main process memory only.
    })

    attempt.on('error', (err: NodeJS.ErrnoException) => {
        attempt.close()
        if (err.code === 'EADDRINUSE') {
            console.warn(`${BRAND.logPrefix} Port ${port} in use, trying ${port + 1}…`)
            tryListen(port + 1)
        } else {
            console.error(`${BRAND.logPrefix} Ingestion server error:`, err)
        }
    })
}

export function startIngestionServer(secret: string): void {
    if (server) {
        console.warn(`${BRAND.logPrefix} Ingestion server already running.`)
        return
    }
    // SEC.2: Validate secret strength before accepting it
    if (!secret || secret.length < 32) {
        throw new Error('startIngestionServer requires a secret of at least 32 characters')
    }
    flintSecret = secret
    tryListen(BASE_PORT)
}

export function stopIngestionServer(): void {
    if (server) {
        server.close(() => {
            console.log(`${BRAND.logPrefix} Ingestion server stopped.`)
        })
        server = null
        flintSecret = null  // SEC.2: Clear secret on stop to prevent stale references
    }
}

export function getServerStatus(): { running: boolean; port: number } {
    return {
        running: server !== null && server.listening,
        port: activePort,
    }
}

/**
 * Returns a snapshot of Figma connection health for the `figma:status` IPC handler.
 *
 *   running       — true when the loopback HTTP server is bound and listening.
 *   lastWebhookAt — Unix timestamp (ms) of the last successful POST /ingest,
 *                   or null if no ingest has occurred in this process lifetime.
 *   tokenCount    — Current row count from the design_tokens table.
 *   port          — The port the ingestion server is currently listening on.
 *
 * SEC.2: The `secret` field has been removed. The per-session secret stays in
 * main process memory only — it must never be returned to the renderer.
 */
export function getFigmaStatus(): { running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number } {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM design_tokens').get() as { count: number }
    return {
        running: server !== null && server.listening,
        lastWebhookAt,
        tokenCount: countRow?.count ?? 0,
        port: activePort,
    }
}
