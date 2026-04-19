/**
 * electron/mcpClient.ts — MCP Client (Phase W.3)
 *
 * Manages a flint-mcp server child process via stdio and exposes
 * `callTool()` and `readResource()` to the Electron main process.
 *
 * Protocol: JSON-RPC 2.0 over stdio (newline-delimited JSON).
 * This matches the StdioServerTransport used by flint-mcp/src/server.ts
 * and avoids adding @modelcontextprotocol/sdk as a root dependency.
 *
 * Lifecycle:
 *   - start(projectRoot)   — Spawns the server process. Idempotent: stops any
 *                            existing process first.
 *   - stop()               — Sends SIGTERM; waits up to 5 s for clean exit.
 *   - reconnect()          — Resets crash counter and re-spawns. No-op if no
 *                            project is open.
 *   - callTool(name, args)  — JSON-RPC tools/call
 *   - readResource(uri)     — JSON-RPC resources/read
 *   - status()              — { connected, serverPid }
 *
 * Crash recovery: exponential backoff up to MAX_RETRIES attempts.
 *
 * Process boundary law:
 *   renderer → preload(ipcRenderer.invoke) → main(ipcMain.handle) → mcpClient → stdio → MCP server
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import { classifyMCPError } from '../shared/mcp-classification.js'
import type { MCPCallClassification } from '../shared/mcp-classification.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPCallResult {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
    /** MINT.5 Phase 3 — structured classification attached by callTool() post-processing. */
    classification?: MCPCallClassification
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

/**
 * Absolute path to the flint-mcp compiled server entry point.
 *
 * Development:  dist-electron/../flint-mcp/dist/server.js  (sibling directory)
 * Production:   Resources/app.asar.unpacked/flint-mcp/dist/server.js
 *               The server is listed under asarUnpack in electron-builder.yml so the
 *               OS can spawn it as a real child process (files inside ASAR are virtual).
 */
const SERVER_ENTRY = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'flint-mcp', 'dist', 'server.js')
    : path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')

/** Timeout (ms) for individual RPC calls. */
const CALL_TIMEOUT_MS = 30_000

/** How long (ms) to wait for graceful shutdown before SIGKILL. */
const SHUTDOWN_GRACE_MS = 5_000

/** Maximum number of automatic restart attempts after unexpected exits. */
const MAX_RETRIES = 5

/** Base delay (ms) for the first retry; doubles with each attempt (capped at 30 s). */
const RETRY_BASE_MS = 1_000

// ── MCP Client class ──────────────────────────────────────────────────────────

class MCPClient {
    private proc: ChildProcess | null = null
    private projectRoot: string | null = null
    private connected = false
    private nextId = 1
    private pendingCalls = new Map<JsonRpcId, {
        resolve: (value: unknown) => void
        reject: (reason: Error) => void
        timer: ReturnType<typeof setTimeout>
    }>()

    /** Number of consecutive crash-restart attempts since last successful connection. */
    private retryCount = 0
    /** Handle for the pending retry timer, if one is scheduled. */
    private retryTimer: ReturnType<typeof setTimeout> | null = null
    /** Accumulated stderr output — searched as a buffer to guard against chunk splits. */
    private _stderrBuffer = ''

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Starts the MCP server process for `projectRoot`.
     * If a process is already running for a different root, stops it first.
     */
    async start(projectRoot: string): Promise<void> {
        if (this.proc !== null) {
            await this.stop()
        }
        this.projectRoot = projectRoot
        this.retryCount = 0
        this._spawn()
    }

    /**
     * Gracefully stops the running server.
     * Sends SIGTERM and waits up to SHUTDOWN_GRACE_MS, then SIGKILL.
     */
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

    /** Invokes an MCP tool by name and returns its result. */
    async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
        this._assertConnected()
        const result = await this._rpc('tools/call', { name, arguments: args })
        const raw = result as MCPCallResult
        // MINT.5 Phase 3: attach classification to every result so renderer consumers
        // can inspect result.classification instead of text-matching the error body.
        const rawText = raw.content?.[0]?.text ?? ''
        const classification = classifyMCPError({ rawText, isError: raw.isError === true })
        return { ...raw, classification }
    }

    /** Reads an MCP resource by URI and returns its contents. */
    async readResource(uri: string): Promise<MCPResourceResult> {
        this._assertConnected()
        const result = await this._rpc('resources/read', { uri })
        return result as MCPResourceResult
    }

    /** Returns current connection status. */
    status(): MCPClientStatus {
        return {
            connected: this.connected,
            serverPid: this.proc?.pid ?? null,
        }
    }

    /**
     * Resets the crash counter and re-spawns the MCP server child process.
     * Safe to call when connected (will stop + restart) or disconnected.
     * No-op if no project root has been set.
     */
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

        // Graceful degradation — if the server hasn't been built yet, log and bail.
        if (!existsSync(SERVER_ENTRY)) {
            console.warn(
                '[Flint] mcpClient: flint-mcp server not built at %s. ' +
                'Run `npm run build` inside flint-mcp/ to enable the Bidirectional Action Flint.',
                SERVER_ENTRY
            )
            return
        }

        // Reset the stderr accumulation buffer for each fresh spawn.
        this._stderrBuffer = ''

        // Spawn the MCP server as a Node.js child process communicating via stdio.
        // ELECTRON_RUN_AS_NODE=1 is required when process.execPath is the Electron
        // binary — without it Electron tries to open SERVER_ENTRY as an app window.
        const proc = spawn(process.execPath, [SERVER_ENTRY], {
            cwd: this.projectRoot,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                FLINT_PROJECT_ROOT: this.projectRoot,
                // Suppress colour codes that can corrupt JSON lines
                NO_COLOR: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.proc = proc
        this.connected = false

        // Read newline-delimited JSON-RPC responses from stdout
        const rl = createInterface({ input: proc.stdout! })
        rl.on('line', (line) => {
            const trimmed = line.trim()
            if (!trimmed) return
            try {
                const msg = JSON.parse(trimmed) as JsonRpcResponse
                this._handleResponse(msg)
            } catch {
                // Non-JSON lines (e.g. startup banners) — safe to ignore
            }
        })

        // Mirror the server's stderr to our stderr for visibility in the dev console.
        // The server writes "[Flint] Project root: …" and "Flint MCP Server listening on stdio"
        // to stderr — we use the latter as a secondary connected signal.
        // Chunks are accumulated in _stderrBuffer so the ready string is found even
        // when it arrives split across multiple data events.
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
                console.log('[Flint] mcpClient: connected via stderr signal (pid=%d)', proc.pid)
            }
            process.stderr.write('[flint-mcp] ' + text)
        })

        proc.once('error', (err) => {
            console.error('[Flint] mcpClient: spawn error', err)
            this._handleCrash()
        })

        proc.once('exit', (code, signal) => {
            // Ignore if we already replaced this proc via stop()
            if (this.proc !== proc) return
            console.warn('[Flint] mcpClient: server exited (code=%s signal=%s)', code, signal)
            this._handleCrash()
        })

        // Send the MCP initialize handshake immediately after spawn.
        // The server must receive this before it accepts tool/resource calls.
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
                clientInfo: { name: 'flint-glass', version: '1.0.0' },
            },
        }

        // Register the handshake so _handleResponse dispatches it.
        // On success: send the required `notifications/initialized` to complete
        // the MCP protocol handshake (server stays in "initializing" state
        // until this notification arrives and will queue — then timeout — all
        // tool/resource calls without it).
        //
        // On timeout: reject with a visible error and trigger _handleCrash() so
        // the exponential-backoff retry path fires. This prevents a late-arriving
        // initialize response from silently succeeding after the entry is gone.
        // MCP server cold start loads ~78 ESM imports, initializes SQLite,
        // and registers all tools/resources before it can respond to initialize.
        // 15s is generous but avoids false-negative timeouts on first launch.
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
                    console.log('[Flint] mcpClient: connected via initialize handshake (pid=%d)', this.proc?.pid)
                }
            },
            reject: (err: Error) => {
                console.error('[Flint] mcpClient: initialize handshake failed —', err.message)
            },
            timer,
        })

        this._send(req)
    }

    /** Sends the MCP `notifications/initialized` notification (no id, no response). */
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
        // Kill the old process if it's still running — don't orphan it.
        if (this.proc) {
            try { this.proc.kill('SIGTERM') } catch { /* already dead */ }
            this.proc = null
        }
        this._rejectAllPending(new Error('MCP server process exited unexpectedly'))

        if (this.retryCount >= MAX_RETRIES) {
            console.error(
                '[Flint] mcpClient: giving up after %d attempts',
                this.retryCount
            )
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
                'Ensure a project is open and flint-mcp is built (npm run build inside flint-mcp/).'
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

// ── Singleton export ──────────────────────────────────────────────────────────

/** Singleton MCP client — shared across all IPC handlers in main.ts. */
export const mcpClient = new MCPClient()
