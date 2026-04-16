/**
 * server/services/__tests__/ingestionServer.test.ts
 *
 * Tests for createIngestionServer() in server/services/ingestionServer.ts.
 *
 * Uses Node.js http.request against a real in-process server to avoid
 * any Express/supertest dependency — the ingestion server is built on
 * raw node:http.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { createIngestionServer } from '../ingestionServer.js'

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const TEST_SECRET = 'supersecretvalue1234' // >= 16 chars

interface HttpResponse {
  status: number
  body: Record<string, unknown>
}

function httpRequest(
  port: number,
  method: string,
  urlPath: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      // Disable keep-alive so each request gets its own socket.
      // This prevents a ECONNRESET on one request from poisoning later ones.
      agent: new http.Agent({ keepAlive: false }),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }

    let statusCode = 0
    let responseData = ''
    let resolved = false

    const req = http.request(opts, (res) => {
      statusCode = res.statusCode ?? 0
      res.on('data', (chunk: Buffer) => { responseData += chunk.toString() })
      res.on('end', () => {
        if (resolved) return
        resolved = true
        try {
          resolve({ status: statusCode, body: JSON.parse(responseData) })
        } catch {
          resolve({ status: statusCode, body: { raw: responseData } })
        }
      })
      // If the server closes the socket after sending headers (no body drain),
      // 'close' fires before 'end'. Resolve with whatever we have.
      res.on('close', () => {
        if (resolved) return
        resolved = true
        try {
          resolve({ status: statusCode, body: responseData ? JSON.parse(responseData) : {} })
        } catch {
          resolve({ status: statusCode, body: { raw: responseData } })
        }
      })
    })

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (resolved) return
      // ECONNRESET means server sent response and closed — treat as a resolved
      // response if we already have a status code.
      if ((err.code === 'ECONNRESET' || err.code === 'EPIPE') && statusCode > 0) {
        resolved = true
        try {
          resolve({ status: statusCode, body: responseData ? JSON.parse(responseData) : {} })
        } catch {
          resolve({ status: statusCode, body: { raw: responseData } })
        }
        return
      }
      reject(err)
    })

    if (method !== 'GET' && method !== 'OPTIONS') {
      req.write(payload)
    }
    req.end()
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createIngestionServer', () => {
  let tmpDir: string
  let port: number
  let svc: ReturnType<typeof createIngestionServer>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'flint-ingest-test-'))
    svc = createIngestionServer()
    // Start with no explicit port — the service defaults to 4545 and walks up
    // to find the first free port. We read the actual bound port from status().
    await svc.start(tmpDir, { secret: TEST_SECRET })
    port = svc.status().port
  })

  afterEach(async () => {
    await svc.stop()
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  // ── health check ─────────────────────────────────────────────────────────

  it('GET /health returns 200 without auth header', async () => {
    const res = await httpRequest(port, 'GET', '/health', '')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  // ── authentication ────────────────────────────────────────────────────────

  it('POST /ingest with no secret header returns 401', async () => {
    const res = await httpRequest(port, 'POST', '/ingest', { variables: {} })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/unauthorized/i)
  })

  it('POST /ingest with wrong secret header returns 401', async () => {
    const res = await httpRequest(port, 'POST', '/ingest', { variables: {} }, {
      'x-flint-secret': 'wrong-secret',
    })
    expect(res.status).toBe(401)
  })

  it('onError callback fires on 401', async () => {
    const errors: unknown[] = []
    svc.onError((d) => errors.push(d))

    await httpRequest(port, 'POST', '/ingest', { variables: {} })
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect((errors[0] as { statusCode: number }).statusCode).toBe(401)
  })

  // ── POST /ingest — valid payloads ─────────────────────────────────────────

  it('POST /ingest with variables payload stores tokens and returns success', async () => {
    const payload = {
      variables: {
        'color/primary': '#1976d2',
        'color/secondary': '#9c27b0',
      },
    }

    const res = await httpRequest(port, 'POST', '/ingest', payload, {
      'x-flint-secret': TEST_SECRET,
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.count).toBe('number')

    // Verify the canonical design-tokens.json was written
    const tokensFile = path.join(tmpDir, '.flint', 'design-tokens.json')
    expect(existsSync(tokensFile)).toBe(true)
  })

  it('POST /ingest with tokens array payload stores and returns count', async () => {
    const payload = {
      tokens: [
        { name: 'primary', value: '#1976d2', type: 'color' },
        { name: 'secondary', value: '#9c27b0', type: 'color' },
        { name: 'spacing-4', value: '16px', type: 'dimension' },
      ],
    }

    const res = await httpRequest(port, 'POST', '/ingest', payload, {
      'x-flint-secret': TEST_SECRET,
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(3)
  })

  it('onIngest callback fires with token count after successful /ingest', async () => {
    const ingested: unknown[] = []
    svc.onIngest((d) => ingested.push(d))

    await httpRequest(port, 'POST', '/ingest', {
      variables: { 'color/primary': '#fff', 'color/secondary': '#000' },
    }, { 'x-flint-secret': TEST_SECRET })

    expect(ingested.length).toBeGreaterThanOrEqual(1)
    expect(typeof (ingested[0] as { tokenCount: number }).tokenCount).toBe('number')
  })

  it('status() reports running: true after start()', () => {
    const s = svc.status()
    expect(s.running).toBe(true)
    expect(s.port).toBeGreaterThan(0)
  })

  // ── POST /ingest-ast ──────────────────────────────────────────────────────

  it('POST /ingest-ast stores the AST payload and returns success', async () => {
    const payload = {
      type: 'application/x-flint-figma-ast',
      payload: { nodes: [{ id: 'abc', type: 'FRAME' }] },
    }

    const res = await httpRequest(port, 'POST', '/ingest-ast', payload, {
      'x-flint-secret': TEST_SECRET,
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const astFile = path.join(tmpDir, '.flint', 'last-ingest-ast.json')
    expect(existsSync(astFile)).toBe(true)
  })

  // ── POST /ingest — malformed payloads ────────────────────────────────────

  it('POST /ingest with invalid JSON returns 400', async () => {
    // Send a raw malformed JSON string — the helper passes strings as-is
    const res = await httpRequest(port, 'POST', '/ingest', '{ this is : not valid json }', {
      'x-flint-secret': TEST_SECRET,
    })
    expect(res.status).toBe(400)
    expect(String(res.body.error ?? '')).toMatch(/invalid json/i)
  })

  it('POST /ingest-ast with invalid JSON returns 400', async () => {
    const res = await httpRequest(port, 'POST', '/ingest-ast', '{broken json!!!', {
      'x-flint-secret': TEST_SECRET,
    })
    expect(res.status).toBe(400)
  })

  // ── 404 fallthrough ───────────────────────────────────────────────────────

  it('unknown route returns 404', async () => {
    const res = await httpRequest(port, 'GET', '/unknown', '', {
      'x-flint-secret': TEST_SECRET,
    })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  // ── lifecycle ─────────────────────────────────────────────────────────────

  it('stop() marks server as not running', async () => {
    await svc.stop()
    const s = svc.status()
    expect(s.running).toBe(false)
  })

  it('start() rejects if secret is too short (< 16 chars)', async () => {
    const freshSvc = createIngestionServer()
    await expect(freshSvc.start(tmpDir, { secret: 'short' })).rejects.toThrow(/16/)
  })

  it('start() rejects if called while already running', async () => {
    await expect(svc.start(tmpDir, { secret: TEST_SECRET })).rejects.toThrow(/already running/)
  })

  // ── CORS preflight ────────────────────────────────────────────────────────

  it('OPTIONS preflight returns 200 without auth', async () => {
    const res = await httpRequest(port, 'OPTIONS', '/ingest', '')
    expect(res.status).toBe(200)
  })
})
