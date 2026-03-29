/**
 * server/services/ingestionServer.ts — Figma Ingestion Server (Web Mode)
 *
 * A lightweight HTTP server that receives Figma plugin payloads and stores
 * them as raw JSON in the project's .flint/ directory. This is the web-mode
 * counterpart to electron/ingestion-server.ts.
 *
 * Key differences from the Electron version:
 *   - No SQLite dependency — tokens are stored as flat JSON files so the
 *     MCP engine can handle normalization on query.
 *   - No BrowserWindow IPC — instead, event callbacks notify the web server
 *     layer which can broadcast over WebSocket.
 *   - No electron-specific imports (BrowserWindow, app, etc.)
 *   - Same security model: loopback-only, x-flint-secret header required.
 *
 * Routes:
 *   POST /ingest     — Figma Variables payload (raw token data)
 *   POST /ingest-ast — Figma component AST for hydration
 *   GET  /health     — Health check
 */

import http from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface IngestionServerService {
  start(projectRoot: string, options: { port?: number; secret: string }): Promise<{ port: number }>
  stop(): Promise<void>
  status(): { running: boolean; port: number; lastWebhookAt: number | null; tokenCount: number }
  onIngest(callback: (data: { tokenCount: number; timestamp: number }) => void): void
  onError(callback: (data: { statusCode: number; reason: string; timestamp: number }) => void): void
}

type IngestCallback = (data: { tokenCount: number; timestamp: number }) => void
type ErrorCallback = (data: { statusCode: number; reason: string; timestamp: number }) => void

// ── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[Flint]'
const SECRET_HEADER = 'x-flint-secret'
const DEFAULT_PORT = 4545
const MAX_PORT_ATTEMPTS = 10
const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Helpers ────────────────────────────────────────────────────────────────

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', `Content-Type, ${SECRET_HEADER}`)
  res.setHeader('Access-Control-Max-Age', '86400')
}

function sendJson(res: http.ServerResponse, status: number, body: object): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    req.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString('utf8')
      if (rawBody.length > maxBytes) {
        req.destroy()
        reject(new Error('Payload too large'))
      }
    })

    req.on('end', () => resolve(rawBody))
    req.on('error', (err) => reject(err))
  })
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createIngestionServer(): IngestionServerService {
  let server: http.Server | null = null
  let activePort = DEFAULT_PORT
  let projectRoot = ''
  let secret = ''
  let lastWebhookAt: number | null = null
  let tokenCount = 0

  const ingestCallbacks: IngestCallback[] = []
  const errorCallbacks: ErrorCallback[] = []

  function emitIngest(data: { tokenCount: number; timestamp: number }): void {
    for (const cb of ingestCallbacks) {
      try { cb(data) } catch { /* callback errors are non-fatal */ }
    }
  }

  function emitError(data: { statusCode: number; reason: string; timestamp: number }): void {
    for (const cb of errorCallbacks) {
      try { cb(data) } catch { /* callback errors are non-fatal */ }
    }
  }

  /** Ensure .flint/tokens/ directory exists and return the path. */
  function ensureTokensDir(): string {
    const tokensDir = path.join(projectRoot, '.flint', 'tokens')
    if (!existsSync(tokensDir)) {
      mkdirSync(tokensDir, { recursive: true })
    }
    return tokensDir
  }

  /** Count stored token files to provide an accurate tokenCount. */
  function countStoredTokens(): number {
    try {
      const tokensFile = path.join(projectRoot, '.flint', 'design-tokens.json')
      if (existsSync(tokensFile)) {
        const raw = readFileSync(tokensFile, 'utf8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.length
        if (typeof parsed === 'object' && parsed !== null) {
          // Could be { variables: [...] } shape
          const vars = (parsed as Record<string, unknown>).variables
          if (Array.isArray(vars)) return vars.length
          return Object.keys(parsed).length
        }
      }
    } catch { /* no tokens file or parse error */ }
    return tokenCount
  }

  /** Store the raw Figma payload as the design-tokens.json file. */
  function storeTokenPayload(payload: unknown): number {
    const flintDir = path.join(projectRoot, '.flint')
    if (!existsSync(flintDir)) {
      mkdirSync(flintDir, { recursive: true })
    }

    // Store the raw payload in a timestamped file for history
    const tokensDir = ensureTokensDir()
    const timestamp = Date.now()
    writeFileSync(
      path.join(tokensDir, `ingest-${timestamp}.json`),
      JSON.stringify(payload, null, 2),
    )

    // Also write to the canonical design-tokens.json location
    // so downstream tools can read it. The MCP engine handles
    // full DTCG normalization — we store the raw Figma payload.
    const tokensFile = path.join(flintDir, 'design-tokens.json')
    const payloadObj = payload as Record<string, unknown>

    // Extract token count from the payload shape
    let count = 0
    if (payloadObj.variables && typeof payloadObj.variables === 'object') {
      count = Object.keys(payloadObj.variables as object).length
    } else if (payloadObj.tokens && Array.isArray(payloadObj.tokens)) {
      count = payloadObj.tokens.length
    } else if (Array.isArray(payload)) {
      count = (payload as unknown[]).length
    }

    writeFileSync(tokensFile, JSON.stringify(payload, null, 2))
    return count
  }

  /** Store the raw AST payload for hydration. */
  function storeAstPayload(payload: string): void {
    const flintDir = path.join(projectRoot, '.flint')
    if (!existsSync(flintDir)) {
      mkdirSync(flintDir, { recursive: true })
    }
    writeFileSync(path.join(flintDir, 'last-ingest-ast.json'), payload)
  }

  // ── Request handler ──────────────────────────────────────────────────────

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    setCorsHeaders(res)

    // CORS preflight — always allowed, no auth check
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // GET /health — no auth required
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    // All POST routes require the secret header
    const headerSecret = req.headers[SECRET_HEADER]
    if (!headerSecret || headerSecret !== secret) {
      const reason = `Unauthorized: missing or invalid ${SECRET_HEADER}`
      sendJson(res, 401, { error: reason })
      emitError({ statusCode: 401, reason, timestamp: Date.now() })
      return
    }

    // POST /ingest — Figma Variables token payload
    if (req.method === 'POST' && req.url === '/ingest') {
      try {
        const rawBody = await readBody(req, MAX_BODY_BYTES)
        const payload: unknown = JSON.parse(rawBody)

        const count = storeTokenPayload(payload)

        if (count === 0) {
          // Payload parsed but no tokens found — still store it but warn
          const reason = 'No tokens extracted from payload. Stored raw data for MCP normalization.'
          sendJson(res, 200, { success: true, count: 0, warning: reason })
        } else {
          tokenCount = count
          lastWebhookAt = Date.now()
          emitIngest({ tokenCount: count, timestamp: lastWebhookAt })
          console.log(`${LOG_PREFIX} /ingest: stored ${count} tokens`)
          sendJson(res, 200, { success: true, count })
        }
      } catch (err) {
        const reason = err instanceof Error && err.message === 'Payload too large'
          ? 'Payload exceeds 10 MB limit'
          : 'Invalid JSON payload'
        sendJson(res, 400, { error: reason })
        emitError({ statusCode: 400, reason, timestamp: Date.now() })
      }
      return
    }

    // POST /ingest-ast — Figma component AST for hydration
    if (req.method === 'POST' && req.url === '/ingest-ast') {
      try {
        const rawBody = await readBody(req, MAX_BODY_BYTES)

        // Validate it parses as JSON
        JSON.parse(rawBody)

        // Extract the actual payload — the Figma plugin may wrap it
        let figmaPayload = rawBody
        try {
          const parsed = JSON.parse(rawBody)
          if (parsed && parsed.type === 'application/x-flint-figma-ast') {
            figmaPayload = typeof parsed.payload === 'string'
              ? parsed.payload
              : JSON.stringify(parsed.payload)
          }
        } catch { /* use rawBody as-is */ }

        storeAstPayload(figmaPayload)

        console.log(`${LOG_PREFIX} /ingest-ast: payload stored`)
        sendJson(res, 200, { success: true })
      } catch (err) {
        const reason = err instanceof Error && err.message === 'Payload too large'
          ? 'Payload exceeds 10 MB limit'
          : 'Invalid JSON payload'
        sendJson(res, 400, { error: reason })
        emitError({ statusCode: 400, reason, timestamp: Date.now() })
      }
      return
    }

    // Fallthrough — 404
    sendJson(res, 404, { error: `Route not found: ${req.method} ${req.url}` })
  }

  // ── Port binding with retry ──────────────────────────────────────────────

  function tryListen(port: number, resolve: (result: { port: number }) => void, reject: (err: Error) => void): void {
    if (port > DEFAULT_PORT + MAX_PORT_ATTEMPTS) {
      reject(new Error(
        `Could not bind to any port in range ${DEFAULT_PORT}-${DEFAULT_PORT + MAX_PORT_ATTEMPTS}`
      ))
      return
    }

    const attempt = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        console.error(`${LOG_PREFIX} Unhandled request error:`, err)
        if (!res.headersSent) {
          sendJson(res, 500, { error: 'Internal server error' })
        }
      })
    })

    attempt.listen(port, '127.0.0.1', () => {
      server = attempt
      activePort = port
      console.log(`${LOG_PREFIX} Ingestion server listening on http://127.0.0.1:${port}`)
      resolve({ port })
    })

    attempt.on('error', (err: NodeJS.ErrnoException) => {
      attempt.close()
      if (err.code === 'EADDRINUSE') {
        console.warn(`${LOG_PREFIX} Port ${port} in use, trying ${port + 1}...`)
        tryListen(port + 1, resolve, reject)
      } else {
        reject(err)
      }
    })
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    start(root: string, options: { port?: number; secret: string }): Promise<{ port: number }> {
      if (server) {
        return Promise.reject(new Error('Ingestion server is already running'))
      }

      if (!options.secret || options.secret.length < 16) {
        return Promise.reject(new Error('Secret must be at least 16 characters'))
      }

      projectRoot = root
      secret = options.secret
      const startPort = options.port ?? DEFAULT_PORT

      return new Promise((resolve, reject) => {
        tryListen(startPort, resolve, reject)
      })
    },

    stop(): Promise<void> {
      return new Promise((resolve) => {
        if (!server) {
          resolve()
          return
        }

        const srv = server
        server = null
        secret = ''

        srv.close(() => {
          console.log(`${LOG_PREFIX} Ingestion server stopped.`)
          resolve()
        })
      })
    },

    status(): { running: boolean; port: number; lastWebhookAt: number | null; tokenCount: number } {
      return {
        running: server !== null && server.listening,
        port: activePort,
        lastWebhookAt,
        tokenCount: server !== null ? countStoredTokens() : tokenCount,
      }
    },

    onIngest(callback: IngestCallback): void {
      ingestCallbacks.push(callback)
    },

    onError(callback: ErrorCallback): void {
      errorCallbacks.push(callback)
    },
  }
}
