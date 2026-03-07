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
 *   - Every non-OPTIONS request must supply a matching x-bridge-secret header.
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

const BASE_PORT = 4545
const MAX_PORT_ATTEMPTS = 10

// In development the secret is predictable; in production the Figma plugin
// and main process will exchange a runtime-generated secret stored in
// project_state. For Phase 2 we use a stable dev value.
const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? 'bridge-dev-secret-phase2'

let server: http.Server | null = null
let activePort = BASE_PORT

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-bridge-secret')
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
    if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
    }

    // 2. Enforce x-bridge-secret on all other methods
    const secret = req.headers['x-bridge-secret']
    if (!secret || secret !== BRIDGE_SECRET) {
        sendJson(res, 401, { error: 'Unauthorized: missing or invalid x-bridge-secret' })
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
                    sendJson(res, 400, {
                        error: 'No tokens produced. Verify the payload contains ' +
                            'variables and variableCollections keys.',
                    })
                    return
                }

                batchUpsertTokens(tokens)

                // Notify the renderer so the token store re-fetches automatically.
                const windows = BrowserWindow.getAllWindows()
                if (windows.length > 0) {
                    windows[0].webContents.send('bridge:tokens-updated')
                }

                console.log(`[Bridge] /ingest: upserted ${tokens.length} tokens`)
                sendJson(res, 200, { success: true, count: tokens.length })
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON payload' })
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

                console.log(`[Bridge] Asset ingested: ${payload.id}`)
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
                if (payload && payload.type === 'application/x-bridge-figma-ast') {
                    figmaPayload = typeof payload.payload === 'string'
                        ? payload.payload
                        : JSON.stringify(payload.payload)
                } else {
                    figmaPayload = rawBody
                }

                // Notify the renderer to perform AST hydration
                const windows = BrowserWindow.getAllWindows()
                if (windows.length > 0) {
                    windows[0].webContents.send('bridge:hydro-paste-auto', figmaPayload)
                }

                console.log('[Bridge] /ingest-ast: received AST payload')
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
            `[Bridge] Could not bind to any port in range ${BASE_PORT}–${BASE_PORT + MAX_PORT_ATTEMPTS}. Ingestion server not started.`
        )
        return
    }

    const attempt = http.createServer(handleRequest)

    attempt.listen(port, '127.0.0.1', () => {
        server = attempt
        activePort = port
        console.log(`[Bridge] Ingestion server listening on http://127.0.0.1:${port}`)
        console.log(`[Bridge] x-bridge-secret: ${BRIDGE_SECRET}`)
    })

    attempt.on('error', (err: NodeJS.ErrnoException) => {
        attempt.close()
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Bridge] Port ${port} in use, trying ${port + 1}…`)
            tryListen(port + 1)
        } else {
            console.error('[Bridge] Ingestion server error:', err)
        }
    })
}

export function startIngestionServer(): void {
    if (server) {
        console.warn('[Bridge] Ingestion server already running.')
        return
    }
    tryListen(BASE_PORT)
}

export function stopIngestionServer(): void {
    if (server) {
        server.close(() => {
            console.log('[Bridge] Ingestion server stopped.')
        })
        server = null
    }
}

export function getServerStatus(): { running: boolean; port: number } {
    return {
        running: server !== null && server.listening,
        port: activePort,
    }
}
