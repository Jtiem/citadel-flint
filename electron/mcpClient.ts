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
 *   - callTool(name, args)  — JSON-RPC tools/call
 *   - readResource(uri)     — JSON-RPC resources/read
 *   - status()              — { connected, serverPid }
 *
 * Crash recovery: if the process exits unexpectedly the client attempts a
 * single automatic restart. A second crash within 10 s is treated as fatal.
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

/** Minimum time (ms) between crashes to trigger a second-crash guard. */
const CRASH_WINDOW_MS = 10_000

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

    /** Unix timestamp (ms) of the last unexpected exit — crash recovery guard. */
    private lastCrashMs: number | null = null
    /** Whether a restart is already scheduled. */
    private restarting = false

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
        this._spawn()
    }

    /**
     * Gracefully stops the running server.
     * Sends SIGTERM and waits up to SHUTDOWN_GRACE_MS, then SIGKILL.
     */
    async stop(): Promise<void> {
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
        return result as MCPCallResult
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

        // Spawn the MCP server as a Node.js child process communicating via stdio.
        const proc = spawn(process.execPath, [SERVER_ENTRY], {
            cwd: this.projectRoot,
            env: {
                ...process.env,
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
        // to stderr — we use the latter as a connected signal.
        proc.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString()
            if (!this.connected && text.includes('Flint MCP Server listening')) {
                this.connected = true
                console.log('[Flint] mcpClient: connected (pid=%d)', proc.pid)
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
        const timer = setTimeout(() => {
            this.pendingCalls.delete(handshakeId)
        }, 3000)

        this.pendingCalls.set(handshakeId, {
            resolve: () => {
                this._sendInitializedNotification()
                if (!this.connected) {
                    this.connected = true
                    console.log('[Flint] mcpClient: connected via initialize handshake')
                }
            },
            reject: () => { /* ignore initialize errors — stderr signal is fallback */ },
            timer,
        })

        this._send(req)

        // Fallback: assume connected after a settle period if stderr signal missed.
        setTimeout(() => {
            if (this.proc && !this.connected) {
                this.connected = true
                console.log('[Flint] mcpClient: assumed connected after handshake settle')
                // Send initialized notification even in fallback path so the server
                // transitions out of "initializing" state.
                this._sendInitializedNotification()
            }
        }, 2000)
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
        if (this.restarting) return
        this.connected = false
        this.proc = null
        this._rejectAllPending(new Error('MCP server process exited unexpectedly'))

        const now = Date.now()
        const isSecondCrash =
            this.lastCrashMs !== null && now - this.lastCrashMs < CRASH_WINDOW_MS

        if (isSecondCrash) {
            console.error(
                '[Flint] mcpClient: second crash within %dms — disabling auto-restart',
                CRASH_WINDOW_MS
            )
            this.lastCrashMs = null
            return
        }

        this.lastCrashMs = now
        this.restarting = true

        console.warn('[Flint] mcpClient: scheduling restart in 1 s…')
        setTimeout(() => {
            this.restarting = false
            if (this.projectRoot !== null) {
                this._spawn()
            }
        }, 1000)
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
