/**
 * server/mcpClient.ts — MCP Client for the web server
 *
 * Adapted from electron/mcpClient.ts with Electron dependencies removed.
 * Manages a flint-mcp server child process via stdio JSON-RPC 2.0.
 *
 * The only change from the Electron version:
 *   - Removed `import { app } from 'electron'`
 *   - SERVER_ENTRY always resolves relative to the repo root (no ASAR path)
 *   - Uses `process.execPath` (Node.js binary) instead of Electron binary
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPCallResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

export interface MCPResourceResult {
  contents: Array<{ uri: string; mimeType?: string; text?: string }>
}

export interface MCPClientStatus {
  connected: boolean
  serverPid: number | null
}

// ── JSON-RPC primitives ───────────────────────────────────────────────────────

type JsonRpcId = number | string

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Timeout (ms) for individual RPC calls. */
const CALL_TIMEOUT_MS = 30_000

/** How long (ms) to wait for graceful shutdown before SIGKILL. */
const SHUTDOWN_GRACE_MS = 5_000

/** Maximum number of automatic restart attempts after unexpected exits. */
const MAX_RETRIES = 5

/** Base delay (ms) for the first retry; doubles with each attempt (capped at 30 s). */
const RETRY_BASE_MS = 1_000

// ── MCP Client class ──────────────────────────────────────────────────────────

export class MCPClient {
  private proc: ChildProcess | null = null
  private projectRoot: string | null = null
  private connected = false
  private nextId = 1
  private pendingCalls = new Map<JsonRpcId, {
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private _stderrBuffer = ''

  /**
   * Resolves the path to flint-mcp/dist/server.js.
   * In the web server context, we're always in development mode —
   * the server directory is a sibling of flint-mcp/.
   */
  private get serverEntry(): string {
    return path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(projectRoot: string): Promise<void> {
    // No-op if already running (or connecting) for the same project root — prevents
    // killing an in-progress handshake when the same path is re-opened (e.g. session restore).
    if (this.proc !== null && this.projectRoot === projectRoot) return
    if (this.proc !== null) {
      await this.stop()
    }
    this.projectRoot = projectRoot
    this.retryCount = 0
    this._spawn()
  }

  async stop(): Promise<void> {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (!this.proc) return
    const proc = this.proc
    this.proc = null
    this.connected = false
    this._rejectAllPending(new Error('MCP client stopped'))

    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        proc.kill('SIGKILL')
        resolve()
      }, SHUTDOWN_GRACE_MS)

      proc.once('exit', () => {
        clearTimeout(killTimer)
        resolve()
      })

      proc.kill('SIGTERM')
    })
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    this._assertConnected()
    const result = await this._rpc('tools/call', { name, arguments: args })
    return result as MCPCallResult
  }

  async readResource(uri: string): Promise<MCPResourceResult> {
    this._assertConnected()
    const result = await this._rpc('resources/read', { uri })
    return result as MCPResourceResult
  }

  status(): MCPClientStatus {
    return {
      connected: this.connected,
      serverPid: this.proc?.pid ?? null,
    }
  }

  reconnect(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.retryCount = 0
    if (this.projectRoot !== null) {
      void this.start(this.projectRoot)
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _spawn(): void {
    if (this.projectRoot === null) return

    const entry = this.serverEntry
    if (!existsSync(entry)) {
      console.warn(
        '[Flint] mcpClient: flint-mcp server not built at %s. ' +
        'Run `cd flint-mcp && npm run build` to enable governance tools.',
        entry
      )
      return
    }

    this._stderrBuffer = ''

    // In web mode, process.execPath is already the Node.js binary — no
    // ELECTRON_RUN_AS_NODE hack needed.
    const proc = spawn(process.execPath, [entry], {
      cwd: this.projectRoot,
      env: {
        ...process.env,
        FLINT_PROJECT_ROOT: this.projectRoot,
        NO_COLOR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.proc = proc
    this.connected = false

    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse
        this._handleResponse(msg)
      } catch {
        // Non-JSON lines — safe to ignore
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this._stderrBuffer += text
      if (!this.connected && this._stderrBuffer.includes('Flint MCP Server listening')) {
        this.connected = true
        this.retryCount = 0
        if (this.retryTimer !== null) {
          clearTimeout(this.retryTimer)
          this.retryTimer = null
        }
        console.log('[Flint] mcpClient: connected (pid=%d)', proc.pid)
      }
      process.stderr.write('[flint-mcp] ' + text)
    })

    proc.once('error', (err) => {
      console.error('[Flint] mcpClient: spawn error', err)
      this._handleCrash()
    })

    proc.once('exit', (code, signal) => {
      if (this.proc !== proc) return
      console.warn('[Flint] mcpClient: server exited (code=%s signal=%s)', code, signal)
      this._handleCrash()
    })

    this._sendHandshake()
  }

  private _sendHandshake(): void {
    const handshakeId = this.nextId++
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: handshakeId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'flint-glass-web', version: '1.0.0' },
      },
    }

    const timer = setTimeout(() => {
      const entry = this.pendingCalls.get(handshakeId)
      if (entry) {
        this.pendingCalls.delete(handshakeId)
        entry.reject(new Error('handshake timeout'))
      }
      console.error('[Flint] mcpClient: initialize handshake timed out — triggering retry')
      this._handleCrash()
    }, 15_000)

    this.pendingCalls.set(handshakeId, {
      resolve: () => {
        this._sendInitializedNotification()
        if (!this.connected) {
          this.connected = true
          this.retryCount = 0
          if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer)
            this.retryTimer = null
          }
          console.log('[Flint] mcpClient: connected via handshake (pid=%d)', this.proc?.pid)
        }
      },
      reject: (err: Error) => {
        console.error('[Flint] mcpClient: handshake failed —', err.message)
      },
      timer,
    })

    this._send(req)
  }

  private _sendInitializedNotification(): void {
    if (!this.proc?.stdin?.writable) return
    const notification = { jsonrpc: '2.0', method: 'notifications/initialized' }
    this.proc.stdin.write(JSON.stringify(notification) + '\n')
  }

  private _handleResponse(msg: JsonRpcResponse): void {
    const pending = this.pendingCalls.get(msg.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingCalls.delete(msg.id)

    if (msg.error) {
      pending.reject(new Error(`MCP RPC error ${msg.error.code}: ${msg.error.message}`))
    } else {
      pending.resolve(msg.result)
    }
  }

  private _handleCrash(): void {
    this.connected = false
    if (this.proc) {
      try { this.proc.kill('SIGTERM') } catch { /* already dead */ }
      this.proc = null
    }
    this._rejectAllPending(new Error('MCP server process exited unexpectedly'))

    if (this.retryCount >= MAX_RETRIES) {
      console.error('[Flint] mcpClient: giving up after %d attempts', this.retryCount)
      return
    }

    const delay = Math.min(RETRY_BASE_MS * 2 ** this.retryCount, 30_000)
    this.retryCount++

    console.warn('[Flint] mcpClient: scheduling restart in %d ms (attempt %d/%d)…', delay, this.retryCount, MAX_RETRIES)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.projectRoot !== null) {
        this._spawn()
      }
    }, delay)
  }

  private _rpc(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id)
        reject(new Error(`MCP call '${method}' timed out after ${CALL_TIMEOUT_MS}ms`))
      }, CALL_TIMEOUT_MS)

      this.pendingCalls.set(id, { resolve, reject, timer })
      this._send(req)
    })
  }

  private _send(req: JsonRpcRequest): void {
    if (!this.proc?.stdin?.writable) {
      console.warn('[Flint] mcpClient: cannot send — stdin not writable')
      return
    }
    const line = JSON.stringify(req) + '\n'
    this.proc.stdin.write(line)
  }

  private _assertConnected(): void {
    if (!this.connected) {
      throw new Error(
        'MCP server is not connected. ' +
        'Ensure flint-mcp is built (cd flint-mcp && npm run build).'
      )
    }
  }

  private _rejectAllPending(reason: Error): void {
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timer)
      pending.reject(reason)
      this.pendingCalls.delete(id)
    }
  }
}
